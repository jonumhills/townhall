// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title IZoningOracle
 * @notice Interface for the Townhall Zoning Oracle.
 *
 * Any smart contract (lending protocol, insurance, DeFi vault, etc.)
 * can import this interface and call the oracle to:
 *   1. Check whether a parcel PIN has been verified on-chain.
 *   2. Retrieve its zoning score (0–100).
 *   3. Gate logic based on minimum score thresholds.
 *
 * Example usage in a lending contract:
 *
 *   import "./IZoningOracle.sol";
 *
 *   IZoningOracle oracle = IZoningOracle(ORACLE_ADDRESS);
 *
 *   function approveLoan(string memory pin, uint256 amount) external {
 *       (uint8 score, bool verified,) = oracle.getZoningScore(pin);
 *       require(verified, "Parcel not oracle-verified");
 *       require(score >= 60, "Zoning score too low for this loan");
 *       // proceed with loan logic...
 *   }
 */
interface IZoningOracle {

    // ── Events ────────────────────────────────────────────────────────────────

    /// @notice Emitted when an oracle admin pushes a new score for a parcel.
    event ParcelUpdated(
        string indexed pin,
        string  zoningCode,
        uint8   score,
        bytes32 merkleRoot,
        uint256 updatedAt
    );

    /// @notice Emitted when an oracle admin is added or removed.
    event OracleAdminChanged(address indexed admin, bool active);

    // ── Core query functions ──────────────────────────────────────────────────

    /**
     * @notice Returns the zoning score and verification status for a PIN.
     * @param pin  The parcel identification number (e.g. "171820").
     * @return score       Zoning score 0–100. 0 means not yet scored.
     * @return verified    True if an oracle admin has pushed data for this PIN.
     * @return updatedAt   Unix timestamp of the last score update.
     */
    function getZoningScore(string calldata pin)
        external
        view
        returns (uint8 score, bool verified, uint256 updatedAt);

    /**
     * @notice Returns full parcel data stored by the oracle.
     * @param pin  The parcel identification number.
     * @return zoningCode  Raw zoning code string (e.g. "R-10", "CX-3").
     * @return score       Zoning score 0–100.
     * @return merkleRoot  Merkle root of the zoning dataset at time of update.
     * @return verified    True if data has been pushed for this PIN.
     * @return updatedAt   Unix timestamp of the last update.
     */
    function getParcelData(string calldata pin)
        external
        view
        returns (
            string memory zoningCode,
            uint8  score,
            bytes32 merkleRoot,
            bool   verified,
            uint256 updatedAt
        );

    /**
     * @notice Convenience check: is a parcel verified AND above a minimum score?
     * @param pin       The parcel identification number.
     * @param minScore  Minimum acceptable zoning score (0–100).
     * @return True if the parcel is verified and score >= minScore.
     *
     * Designed to be used as a single-line gate in other contracts:
     *   require(oracle.isEligible(pin, 60), "Parcel not eligible");
     */
    function isEligible(string calldata pin, uint8 minScore)
        external
        view
        returns (bool);
}
