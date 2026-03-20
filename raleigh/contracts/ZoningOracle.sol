// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./IZoningOracle.sol";

/**
 * @title ZoningOracle
 * @notice On-chain registry of oracle-verified parcel zoning scores.
 *
 * Deployed on Hedera EVM. The Townhall backend pushes verified zoning
 * data here after confirming a Merkle proof. Any other smart contract
 * can query a PIN to get its zoning score and use it as a trust signal.
 *
 * Architecture:
 *   Backend (Supabase + Merkle proof) → pushes → ZoningOracle (Hedera)
 *                                                      ↓ queried by
 *                                         LendingProtocol, InsuranceVault, etc.
 *
 * Access control:
 *   - owner       : contract deployer, can add/remove oracle admins
 *   - oracleAdmin : address(es) authorised to push parcel scores
 */
contract ZoningOracle is IZoningOracle {

    // ── Storage ───────────────────────────────────────────────────────────────

    address public owner;

    struct ParcelRecord {
        string  zoningCode;   // e.g. "R-10", "CX-3"
        uint8   score;        // 0–100
        bytes32 merkleRoot;   // Merkle root of zoning dataset at time of update
        bool    verified;     // true once first update pushed
        uint256 updatedAt;    // unix timestamp
    }

    /// @dev PIN string → parcel record
    mapping(string => ParcelRecord) private _parcels;

    /// @dev Authorised oracle admin addresses
    mapping(address => bool) public oracleAdmins;

    /// @dev All PINs that have ever been updated — for off-chain enumeration
    string[] private _allPins;
    mapping(string => bool) private _pinIndexed;

    // ── Modifiers ─────────────────────────────────────────────────────────────

    modifier onlyOwner() {
        require(msg.sender == owner, "ZoningOracle: not owner");
        _;
    }

    modifier onlyOracle() {
        require(
            oracleAdmins[msg.sender] || msg.sender == owner,
            "ZoningOracle: not oracle admin"
        );
        _;
    }

    // ── Constructor ───────────────────────────────────────────────────────────

    constructor() {
        owner = msg.sender;
        oracleAdmins[msg.sender] = true;
        emit OracleAdminChanged(msg.sender, true);
    }

    // ── Admin functions ───────────────────────────────────────────────────────

    /**
     * @notice Add or remove an oracle admin address.
     * @param admin   Address to update.
     * @param active  True to grant, false to revoke.
     */
    function setOracleAdmin(address admin, bool active) external onlyOwner {
        require(admin != address(0), "ZoningOracle: zero address");
        oracleAdmins[admin] = active;
        emit OracleAdminChanged(admin, active);
    }

    /**
     * @notice Transfer contract ownership.
     */
    function transferOwnership(address newOwner) external onlyOwner {
        require(newOwner != address(0), "ZoningOracle: zero address");
        owner = newOwner;
    }

    // ── Oracle write function ─────────────────────────────────────────────────

    /**
     * @notice Push verified zoning data for a parcel PIN.
     *         Called by the Townhall backend after Merkle proof confirmation.
     *
     * @param pin         Parcel identification number (e.g. "171820").
     * @param zoningCode  Zoning classification (e.g. "R-10", "CX-3").
     * @param score       Zoning score 0–100.
     * @param merkleRoot  Merkle root of the zoning dataset used for verification.
     */
    function updateParcel(
        string  calldata pin,
        string  calldata zoningCode,
        uint8   score,
        bytes32 merkleRoot
    ) external onlyOracle {
        require(bytes(pin).length > 0,        "ZoningOracle: empty PIN");
        require(bytes(zoningCode).length > 0, "ZoningOracle: empty zoning code");
        require(score <= 100,                 "ZoningOracle: score out of range");

        _parcels[pin] = ParcelRecord({
            zoningCode: zoningCode,
            score:      score,
            merkleRoot: merkleRoot,
            verified:   true,
            updatedAt:  block.timestamp
        });

        // Track PIN for enumeration
        if (!_pinIndexed[pin]) {
            _allPins.push(pin);
            _pinIndexed[pin] = true;
        }

        emit ParcelUpdated(pin, zoningCode, score, merkleRoot, block.timestamp);
    }

    /**
     * @notice Batch update multiple parcels in one transaction.
     *         More gas-efficient when pushing many parcels at once.
     */
    function batchUpdateParcels(
        string[]  calldata pins,
        string[]  calldata zoningCodes,
        uint8[]   calldata scores,
        bytes32   merkleRoot        // single root covers the whole batch
    ) external onlyOracle {
        require(
            pins.length == zoningCodes.length && pins.length == scores.length,
            "ZoningOracle: array length mismatch"
        );

        for (uint256 i = 0; i < pins.length; i++) {
            require(scores[i] <= 100, "ZoningOracle: score out of range");

            _parcels[pins[i]] = ParcelRecord({
                zoningCode: zoningCodes[i],
                score:      scores[i],
                merkleRoot: merkleRoot,
                verified:   true,
                updatedAt:  block.timestamp
            });

            if (!_pinIndexed[pins[i]]) {
                _allPins.push(pins[i]);
                _pinIndexed[pins[i]] = true;
            }

            emit ParcelUpdated(pins[i], zoningCodes[i], scores[i], merkleRoot, block.timestamp);
        }
    }

    // ── IZoningOracle implementation ──────────────────────────────────────────

    /// @inheritdoc IZoningOracle
    function getZoningScore(string calldata pin)
        external
        view
        override
        returns (uint8 score, bool verified, uint256 updatedAt)
    {
        ParcelRecord storage r = _parcels[pin];
        return (r.score, r.verified, r.updatedAt);
    }

    /// @inheritdoc IZoningOracle
    function getParcelData(string calldata pin)
        external
        view
        override
        returns (
            string memory zoningCode,
            uint8  score,
            bytes32 merkleRoot,
            bool   verified,
            uint256 updatedAt
        )
    {
        ParcelRecord storage r = _parcels[pin];
        return (r.zoningCode, r.score, r.merkleRoot, r.verified, r.updatedAt);
    }

    /// @inheritdoc IZoningOracle
    function isEligible(string calldata pin, uint8 minScore)
        external
        view
        override
        returns (bool)
    {
        ParcelRecord storage r = _parcels[pin];
        return r.verified && r.score >= minScore;
    }

    // ── Enumeration helpers ───────────────────────────────────────────────────

    /// @notice Returns the total number of unique PINs tracked.
    function totalParcels() external view returns (uint256) {
        return _allPins.length;
    }

    /// @notice Returns a page of PINs for off-chain indexing.
    /// @param offset  Start index.
    /// @param limit   Max entries to return.
    function getPins(uint256 offset, uint256 limit)
        external
        view
        returns (string[] memory)
    {
        uint256 end = offset + limit;
        if (end > _allPins.length) end = _allPins.length;
        string[] memory result = new string[](end - offset);
        for (uint256 i = offset; i < end; i++) {
            result[i - offset] = _allPins[i];
        }
        return result;
    }
}
