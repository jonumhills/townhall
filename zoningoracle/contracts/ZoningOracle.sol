// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

/**
 * @title ZoningOracle
 * @notice Stores verified zoning petition data snapshots from Chainlink CRE
 * @dev Data is stored in Supabase, Merkle root stored on-chain for verification
 */
contract ZoningOracle {

    struct DataSnapshot {
        bytes32 merkleRoot;      // Merkle root of all petitions
        uint256 timestamp;       // When this data was verified
        uint256 petitionCount;   // Number of petitions in this snapshot
        bytes32 dataHash;        // Keccak256 hash of the petition data
    }

    // Latest verified data snapshot
    DataSnapshot public latestData;

    // Historical snapshots (optional - for audit trail)
    DataSnapshot[] public snapshots;

    // Oracle address (Chainlink CRE workflow)
    address public oracleAddress;

    // Events
    event OracleDataUpdated(
        bytes32 merkleRoot,
        uint256 timestamp,
        uint256 petitionCount,
        bytes32 dataHash
    );

    constructor(address _oracleAddress) {
        oracleAddress = _oracleAddress;
    }

    /**
     * @notice Update oracle data with new verified snapshot
     * @dev Only callable by the oracle address (Chainlink CRE workflow)
     * @param _merkleRoot Merkle root of all petition data
     * @param _petitionCount Number of petitions in this snapshot
     * @param _dataHash Keccak256 hash of the petition JSON data
     */
    function updateOracleData(
        bytes32 _merkleRoot,
        uint256 _petitionCount,
        bytes32 _dataHash
    ) external {
        require(msg.sender == oracleAddress, "Only oracle can update");

        // Create new snapshot
        DataSnapshot memory newSnapshot = DataSnapshot({
            merkleRoot: _merkleRoot,
            timestamp: block.timestamp,
            petitionCount: _petitionCount,
            dataHash: _dataHash
        });

        // Update latest data
        latestData = newSnapshot;

        // Store in history
        snapshots.push(newSnapshot);

        emit OracleDataUpdated(_merkleRoot, block.timestamp, _petitionCount, _dataHash);
    }

    /**
     * @notice Get the latest verified Merkle root
     * @return Latest Merkle root
     */
    function getLatestMerkleRoot() external view returns (bytes32) {
        return latestData.merkleRoot;
    }

    /**
     * @notice Get the latest data hash for verification
     * @return Latest data hash
     */
    function getLatestDataHash() external view returns (bytes32) {
        return latestData.dataHash;
    }

    /**
     * @notice Get complete latest snapshot info
     * @return merkleRoot Merkle root of petition data
     * @return timestamp When data was verified
     * @return petitionCount Number of petitions
     * @return dataHash Data verification hash
     */
    function getLatestSnapshot() external view returns (
        bytes32 merkleRoot,
        uint256 timestamp,
        uint256 petitionCount,
        bytes32 dataHash
    ) {
        return (
            latestData.merkleRoot,
            latestData.timestamp,
            latestData.petitionCount,
            latestData.dataHash
        );
    }

    /**
     * @notice Get historical snapshot by index
     * @param index Index in the snapshots array
     * @return merkleRoot Merkle root of petition data
     * @return timestamp When data was verified
     * @return petitionCount Number of petitions
     * @return dataHash Data verification hash
     */
    function getSnapshot(uint256 index) external view returns (
        bytes32 merkleRoot,
        uint256 timestamp,
        uint256 petitionCount,
        bytes32 dataHash
    ) {
        require(index < snapshots.length, "Index out of bounds");
        DataSnapshot memory snapshot = snapshots[index];
        return (
            snapshot.merkleRoot,
            snapshot.timestamp,
            snapshot.petitionCount,
            snapshot.dataHash
        );
    }

    /**
     * @notice Get total number of snapshots
     * @return Total snapshots stored
     */
    function getSnapshotCount() external view returns (uint256) {
        return snapshots.length;
    }

    /**
     * @notice Verify a petition's Merkle proof against a snapshot
     * @param proof Merkle proof array
     * @param leaf Hash of the petition data
     * @param snapshotIndex Index of snapshot to verify against (use snapshots.length - 1 for latest)
     * @return bool True if proof is valid
     */
    function verifyPetition(
        bytes32[] memory proof,
        bytes32 leaf,
        uint256 snapshotIndex
    ) external view returns (bool) {
        require(snapshotIndex < snapshots.length, "Invalid snapshot");

        bytes32 computedHash = leaf;
        for (uint256 i = 0; i < proof.length; i++) {
            bytes32 proofElement = proof[i];
            if (computedHash <= proofElement) {
                computedHash = keccak256(abi.encodePacked(computedHash, proofElement));
            } else {
                computedHash = keccak256(abi.encodePacked(proofElement, computedHash));
            }
        }

        return computedHash == snapshots[snapshotIndex].merkleRoot;
    }

    /**
     * @notice Update oracle address (in case CRE workflow address changes)
     * @dev Only current oracle can update
     * @param newOracle New oracle address
     */
    function updateOracleAddress(address newOracle) external {
        require(msg.sender == oracleAddress, "Only oracle can update");
        oracleAddress = newOracle;
    }
}
