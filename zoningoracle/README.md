# Zoning Oracle - CRE-Powered Verification System

![Townhall Banner](https://img.shields.io/badge/Chainlink-Convergence-375BD2?style=for-the-badge&logo=chainlink)
![Multi-Chain](https://img.shields.io/badge/Multi--Chain-RWA-success?style=for-the-badge)
![License](https://img.shields.io/badge/License-MIT-blue?style=for-the-badge)

**A Chainlink CRE-powered oracle that brings Durham County zoning petition data on-chain with cryptographic verification on Hedera blockchain**

---

## Table of Contents

- [Solution Architecture: The Oracle](#solution-architecture-the-oracle)
- [What is CRE's Role?](#what-is-cres-role)
- [What is the Oracle's Role?](#what-is-the-oracles-role)
- [Architecture Diagram](#architecture-diagram)
- [Components](#components)
- [Quick Start](#quick-start)
- [Data Flow](#data-flow)
- [Verification](#verification)
- [API Documentation](#api-documentation)
- [Smart Contract Interface](#smart-contract-interface)
- [Live Demo Links](#live-demo-links)
- [Production Deployment](#production-deployment)

---

## Solution Architecture: The Oracle

The **Zoning Oracle** is a complete end-to-end system that solves a critical problem in real estate lending: verifying zoning data that only exists on unstructured government websites.

### The Problem

Durham County publishes zoning petitions on HTML web pages with no API. This creates two challenges:

1. **Data Access**: Unstructured HTML pages, no structured query interface
2. **Data Trust**: No cryptographic proof that the data is legitimate or unchanged

### The Solution: 4-Layer Oracle Architecture

```
┌─────────────────────────────────────────────────────────────┐
│  Layer 1: DATA EXTRACTION                                   │
│  - Web scraper extracts petition data from county website   │
│  - Structures data into Supabase database                   │
│  - Runs daily to capture new filings and updates            │
│  - Current: 1087 petitions stored                           │
└──────────────────────────┬──────────────────────────────────┘
                           │
                           ↓
┌─────────────────────────────────────────────────────────────┐
│  Layer 2: VERIFICATION VIA CRE ⭐ (Trust Layer)             │
│  - Chainlink CRE workflow runs daily                        │
│  - Fetches all petitions from Supabase                      │
│  - Computes Merkle tree in sandboxed WASM environment       │
│  - Generates 32-byte cryptographic root                     │
│  - 🔒 Isolated execution - tamper-proof computation         │
└──────────────────────────┬──────────────────────────────────┘
                           │
                           ↓
┌─────────────────────────────────────────────────────────────┐
│  Layer 3: ON-CHAIN ATTESTATION (Hedera)                     │
│  - CRE writes Merkle root to Hedera smart contract          │
│  - Stores: Merkle root + timestamp + petition count         │
│  - Creates immutable historical audit trail                 │
│  - Public verification - anyone can read and verify         │
└──────────────────────────┬──────────────────────────────────┘
                           │
                           ↓
┌─────────────────────────────────────────────────────────────┐
│  Layer 4: QUERY API (Consumer Interface)                    │
│  - Lenders query parcel data via REST API                   │
│  - Returns: Petition data + Merkle proof + Hedera TX        │
│  - Users verify cryptographically without trusting API      │
│  - Query by parcel PIN or petition number                   │
└─────────────────────────────────────────────────────────────┘
```

**Key Innovation**: CRE's sandboxed execution transforms a centralized database into a trustless oracle by ensuring cryptographic proofs cannot be forged.

---

## What is CRE's Role?

**CRE (Chainlink Compute Runtime Environment) is the trust engine of this oracle.**

### Without CRE:

❌ I could compute fake Merkle roots
❌ I could manipulate timestamps
❌ Lenders would have to trust my server
❌ No way to verify data integrity

### With CRE:

✅ Computation happens in Chainlink's sandboxed WebAssembly environment
✅ I cannot interfere with Merkle tree generation
✅ CRE's isolated execution ensures honest attestation
✅ Chainlink's decentralized infrastructure backs the verification
✅ Creates tamper-proof cryptographic proofs

### How CRE Works (Daily Workflow):

```javascript
// Runs in Chainlink's isolated WASM environment
1. Cron Trigger: Wakes up daily at midnight
2. HTTP Fetch: Retrieves all 1087 petitions from Supabase
3. Compute: Builds Merkle tree from petition data
4. Extract: Generates 32-byte Merkle root (cryptographic fingerprint)
5. Write: Calls Hedera smart contract via API
6. Attest: Chainlink signs the transaction
```

**Critical Point**: Even though I control the Supabase database, I **cannot forge CRE's Merkle root computation**. The sandboxed execution ensures the verification is decentralized and tamper-proof.

**CRE transforms my centralized data pipeline into a trustless oracle.**

---

## What is the Oracle's Role?

**The oracle is the complete end-to-end system** that brings off-chain zoning data on-chain with cryptographic verification.

### Oracle Components:

1. **Data Source**: Durham County website (off-chain, unstructured)
2. **Data Warehouse**: Supabase PostgreSQL (off-chain, structured)
3. **Verification Layer**: CRE workflow (decentralized compute)
4. **Attestation Layer**: Hedera smart contract (on-chain proof)
5. **Query Interface**: REST API (consumer-facing)

### What the Oracle Provides:

✅ **Data Bridging**: Off-chain → On-chain
✅ **Cryptographic Verification**: Merkle proofs
✅ **Historical Audit Trail**: Immutable snapshots on Hedera
✅ **Trustless Queries**: Users verify, don't trust
✅ **Instant Access**: Query 1087 petitions in milliseconds
✅ **Fraud Prevention**: Blockchain-backed proof of authenticity

### Oracle Value Proposition:

**Without Oracle**:

- Lenders call county clerk and wait days
- Manual verification, prone to errors
- No proof of data authenticity
- Expensive, slow, unreliable

**With Oracle**:

- Instant API queries (milliseconds)
- Cryptographic verification via CRE
- Blockchain-backed proof on Hedera
- Automated daily updates
- Reduces loan approval from days to minutes

**The oracle solves both the data access problem (scraping + structuring) AND the trust problem (CRE verification).**

---

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────┐
│  Durham County Website (Unstructured HTML)                  │
│  - No API, no database access                               │
│  - Data scattered across multiple pages                     │
└────────────────┬────────────────────────────────────────────┘
                 │
                 │ Daily web scraping
                 ↓
┌─────────────────────────────────────────────────────────────┐
│  Custom Web Scraper (Automation Layer)                      │
│  - Extracts: petition_number, parcel PINs, status, dates    │
│  - Runs: Every day at 2 AM                                  │
│  - Output: Structured JSON                                  │
└────────────────┬────────────────────────────────────────────┘
                 │
                 │ Incremental insert
                 ↓
┌─────────────────────────────────────────────────────────────┐
│  Supabase Database (Structured Data Layer)                  │
│  - 1087 petitions with full metadata                        │
│  - Fast queries by PIN/petition number                      │
│  - REST API: /rest/v1/petitions                             │
│  - ⚠️ TRUST PROBLEM: Centralized, could be manipulated      │
└────────────────┬────────────────────────────────────────────┘
                 │
                 │ CRE fetches all records
                 ↓
┌─────────────────────────────────────────────────────────────┐
│  CHAINLINK CRE WORKFLOW ⭐ (Verification Layer)             │
│  ────────────────────────────────────────────────────       │
│  Runtime: WebAssembly sandboxed environment                 │
│  Trigger: Cron job (daily at midnight)                      │
│                                                              │
│  Steps:                                                      │
│  1. HTTP fetch all petitions from Supabase                  │
│  2. Compute Merkle tree (hash each petition)                │
│  3. Generate 32-byte Merkle root                            │
│  4. Call Hedera API to write proof                          │
│  5. Return transaction hash                                 │
│                                                              │
│  🔒 Isolated execution - I cannot tamper with this process  │
│  ✅ Chainlink's decentralized infrastructure                │
└────────────────┬────────────────────────────────────────────┘
                 │
                 │ Write Merkle root
                 ↓
┌─────────────────────────────────────────────────────────────┐
│  Hedera Smart Contract (On-Chain Attestation)               │
│  ────────────────────────────────────────────               │
│  Address: 0x00000000000000000000000000000000007b3859        │
│  Network: Hedera Testnet                                    │
│                                                              │
│  Stores:                                                     │
│  - bytes32 merkleRoot (cryptographic proof)                 │
│  - uint256 timestamp (when verified)                        │
│  - uint256 petitionCount (total records)                    │
│  - bytes32 dataHash (additional integrity check)            │
│                                                              │
│  Features:                                                   │
│  - Immutable: Cannot be changed once written                │
│  - Public: Anyone can read and verify                       │
│  - Historical: Stores all snapshots                         │
└────────────────┬────────────────────────────────────────────┘
                 │
                 │ Query flow
                 ↓
┌─────────────────────────────────────────────────────────────┐
│  Oracle Query API (REST Interface)                          │
│  ────────────────────────────                               │
│  GET /query/:pin - Query by parcel PIN or petition number   │
│  GET /history    - Get verification history                 │
│  GET /status     - Get latest snapshot info                 │
│                                                              │
│  Response includes:                                          │
│  - Petition data (from Supabase)                            │
│  - Merkle proof (computed from CRE's tree)                  │
│  - Hedera transaction (blockchain attestation)              │
│  - Verification instructions                                │
└─────────────────────────────────────────────────────────────┘
                 │
                 ↓
         Lender verifies Merkle proof
         against on-chain Merkle root
         ✅ Cryptographic certainty
```

---

## Components

### 1. Web Scraper (Data Extraction Layer)

**Purpose**: Extract unstructured zoning data from Durham County website

- **Technology**: Python/Node.js scraper
- **Schedule**: Daily at 2 AM
- **Process**:
  - Navigates county website HTML pages
  - Extracts petition numbers, parcel PINs, applicants, statuses, dates
  - Structures into JSON format
  - Incrementally updates Supabase database
- **Output**: Structured petition data ready for CRE verification

### 2. Supabase Database (Storage Layer)

**Purpose**: Structured storage and query interface for petition data

- **Database**: PostgreSQL with REST API
- **Endpoint**: `https://dhdqxsrgdurcuadmbypj.supabase.co/rest/v1/petitions`
- **Current Data**: 1087 petitions (913 parcels)
- **Features**:
  - Fast queries by PIN or petition number
  - Pagination support (1000 records per request)
  - Authentication via API key

### 3. Chainlink CRE Workflow ([cre-workflow-new/](cre-workflow-new/))

**Purpose**: Tamper-proof verification computation

- **Runtime**: WebAssembly sandboxed environment
- **Trigger**: Cron job (daily at midnight)
- **Actions**:
  1. Fetches all petitions from Supabase REST API (with pagination)
  2. Computes Merkle tree of entire dataset
  3. Generates 32-byte cryptographic root
  4. Calls Hedera API to write proof on-chain
- **Key Feature**: Isolated execution ensures I cannot manipulate the computation

### 4. Hedera Smart Contract ([contracts/](contracts/))

**Purpose**: Store cryptographic proofs on-chain

- **Address**: `0x00000000000000000000000000000000007b3859`
- **Network**: Hedera Testnet
- **Storage**:
  - Merkle root (32 bytes)
  - Timestamp (when CRE verified)
  - Petition count (total records)
  - Data hash (additional integrity check)
- **Explorer**: [HashScan Contract](https://hashscan.io/testnet/contract/0x00000000000000000000000000000000007b3859)

### 5. Oracle Query API ([hedera-api/](hedera-api/))

**Purpose**: Consumer-facing REST API for verified data queries

- **Endpoints**:
  - `GET /query/:pin` - Query by parcel PIN or petition number
  - `GET /history` - Get verification history (last 10 snapshots)
  - `GET /status` - Get latest snapshot information
  - `GET /health` - Health check
  - `POST /verify` - Write verification (internal, called by CRE)

- **Response Format**:

```json
{
  "success": true,
  "found": true,
  "matchType": "petition_number",
  "petition": {
    "number": "Z-19-2021",
    "type": "Rezoning",
    "description": "Rezone from residential to commercial",
    "status": "Approved",
    "filedDate": "2021-03-15",
    "hearingDate": "2021-04-20",
    "applicant": "ABC Development LLC",
    "totalParcels": 3
  },
  "verification": {
    "merkleRoot": "0x2f5d8563...",
    "verifiedAt": "2026-03-04T06:47:50.000Z",
    "petitionCount": "1087",
    "hederaContract": "0x00000000000000000000000000000000007b3859",
    "hederaExplorer": "https://hashscan.io/testnet/contract/..."
  },
  "allParcels": [
    { "pin": "1234567890", "address": "123 Main St" },
    { "pin": "0987654321", "address": "456 Oak Ave" }
  ]
}
```

---

## Quick Start

### Prerequisites

- Node.js v20+
- Chainlink CRE CLI (`npm install -g @chainlink/cre-cli`)
- Hedera account with testnet HBAR

### Setup

1. **Install dependencies**:

```bash
# CRE Workflow
cd cre-workflow-new/zoning-oracle
npm install

# Smart Contracts
cd ../../contracts
npm install

# API Server
cd ../hedera-api
npm install
```

2. **Configure environment** (`contracts/.env`):

```bash
PRIVATE_KEY=0xYOUR_HEDERA_PRIVATE_KEY
ACCOUNT_ID=0.0.YOUR_ACCOUNT
EVM_ADDRESS=0xYOUR_EVM_ADDRESS
```

### Run Complete Workflow

**Option 1: Automated Script with API** (Recommended)

```bash
./run-oracle-automated.sh
```

This script:

1. Starts Hedera API server in background
2. Runs CRE simulation (Supabase → Merkle tree → Hedera)
3. Extracts Merkle root and transaction details
4. Queries contract to verify on-chain data
5. Stops API server

**Option 2: Manual Steps**

1. **Start API Server**:

```bash
cd hedera-api
npm start
# Server runs on http://localhost:3000
```

2. **Run CRE Simulation**:

```bash
cd cre-workflow-new
cre workflow simulate zoning-oracle --target staging-settings --broadcast
```

3. **CRE automatically calls API** to write Merkle root to Hedera

4. **Query parcel data**:

```bash
curl http://localhost:3000/query/Z-19-2021
```

5. **Verify on-chain**:

```bash
cd contracts
npm run query
```

---

## Data Flow

### Daily Oracle Workflow

**1. Data Extraction (2 AM)**

```
Durham County Website
    ↓ Scraper extracts
[1087 petitions]
    ↓ Structured JSON
Supabase Database
```

**2. Verification (Midnight - CRE Workflow)**

```
CRE Workflow Triggered
    ↓
Fetch all petitions from Supabase
    ↓
Compute Merkle tree in sandboxed WASM
    ↓
Generate 32-byte Merkle root: 0x2f5d8563...
    ↓
Call Hedera API: POST /verify
    ↓
API writes Merkle root to Hedera contract
    ↓
Transaction confirmed: 0x19de8679...
    ↓
Snapshot #3 created on-chain
```

**3. Query Flow (Anytime)**

```
Lender: GET /query/Z-19-2021
    ↓
API fetches petition from Supabase
    ↓
API fetches Merkle root from Hedera
    ↓
API generates Merkle proof
    ↓
Returns: Petition + Proof + Hedera TX
    ↓
Lender verifies: hash(petition) + proof = Merkle root
    ↓
✅ Cryptographic certainty
```

---

## Verification

### How to Verify Data Integrity

Anyone can verify that the petition data is authentic:

**Step 1: Fetch data from Supabase**

```bash
curl "https://dhdqxsrgdurcuadmbypj.supabase.co/rest/v1/petitions?select=*" \
  -H "apikey: YOUR_SUPABASE_KEY"
```

**Step 2: Compute Merkle root**

```javascript
import { MerkleTree } from 'merkletreejs';
import { keccak256 } from 'ethers';

const petitions = /* fetched from Supabase */;
const leaves = petitions.map(p => keccak256(JSON.stringify(p)));
const tree = new MerkleTree(leaves, keccak256, { sortPairs: true });
const computedRoot = tree.getHexRoot();
```

**Step 3: Compare with on-chain Merkle root**

```bash
cd contracts
npm run query
# Check that Merkle root matches your computed root
```

**Step 4: Verify Merkle proof for specific petition**

```javascript
const petition = petitions.find((p) => p.petition_number === "Z-19-2021");
const leaf = keccak256(JSON.stringify(petition));
const proof = tree.getHexProof(leaf);
const verified = tree.verify(proof, leaf, computedRoot);

console.log(verified); // true = petition is authentic
```

**If Merkle roots match → Data verified by Chainlink CRE + stored immutably on Hedera!** ✅

---

## API Documentation

### Base URL

```
http://localhost:3000
```

### Endpoints

#### `GET /query/:pin`

Query parcel by PIN or petition number

**Parameters:**

- `pin` (path) - Parcel PIN or petition number (e.g., "Z-19-2021")

**Response:**

```json
{
  "success": true,
  "found": true,
  "matchType": "petition_number",
  "petition": {
    /* petition details */
  },
  "verification": {
    /* Merkle root, Hedera TX */
  },
  "allParcels": [
    /* all parcels in petition */
  ]
}
```

#### `GET /history`

Get snapshot history (last 10 verifications)

**Response:**

```json
{
  "success": true,
  "totalSnapshots": 10,
  "snapshots": [
    {
      "index": 2,
      "merkleRoot": "0x2f5d8563...",
      "timestamp": "2026-03-04T06:47:50.000Z",
      "petitionCount": "1087",
      "dataHash": "0x..."
    }
  ]
}
```

#### `GET /status`

Get latest snapshot information

**Response:**

```json
{
  "success": true,
  "contract": "0x00000000000000000000000000000000007b3859",
  "totalSnapshots": 3,
  "latestSnapshot": {
    "merkleRoot": "0x2f5d8563...",
    "timestamp": "2026-03-04T06:47:50.000Z",
    "petitionCount": "1087",
    "dataHash": "0x..."
  }
}
```

#### `POST /verify` (Internal - called by CRE)

Write verification proof to Hedera

**Body:**

```json
{
  "merkleRoot": "0x2f5d8563...",
  "petitionCount": 1087,
  "dataHash": "0x..."
}
```

---

## Smart Contract Interface

### Read Functions

```solidity
// Get latest verified snapshot
function getLatestSnapshot() external view returns (
    bytes32 merkleRoot,
    uint256 timestamp,
    uint256 petitionCount,
    bytes32 dataHash
)

// Get specific snapshot by index
function getSnapshot(uint256 index) external view returns (
    bytes32 merkleRoot,
    uint256 timestamp,
    uint256 petitionCount,
    bytes32 dataHash
)

// Get total number of snapshots
function getSnapshotCount() external view returns (uint256)
```

### Write Functions (Only Authorized Oracle)

```solidity
// Update oracle data with new snapshot
function updateOracleData(
    bytes32 _merkleRoot,
    uint256 _petitionCount,
    bytes32 _dataHash
) external onlyOracle

// Change authorized oracle address (only owner)
function setOracle(address _oracle) external onlyOwner
```

---

## Live Demo Links

- **Hedera Contract**: [0x00000000000000000000000000000000007b3859](https://hashscan.io/testnet/contract/0x00000000000000000000000000000000007b3859)
- **Latest Transaction**: [View on HashScan](https://hashscan.io/testnet/transaction/0x19de867959adf6822ce534f73bd39b9179ef783a3ba95f94ac872a40a9b1a377)
- **Supabase API**: `https://dhdqxsrgdurcuadmbypj.supabase.co/rest/v1/petitions`

### Current Snapshot

- **Merkle Root**: `0x2f5d85634a847a4ca08d7e08984d6d7ce2f3d2bd9cc8659db20009b0e5bc1ac9`
- **Petition Count**: 1087
- **Verified At**: 2026-03-04T06:47:50.000Z
- **Block**: 32279727

---

## Project Structure

```
zoningoracle/
├── cre-workflow-new/
│   ├── zoning-oracle/
│   │   ├── main.ts                # CRE workflow logic (Merkle tree computation)
│   │   ├── config.staging.json    # Supabase credentials + settings
│   │   └── workflow.yaml          # Workflow metadata (cron trigger)
│   └── project.yaml               # RPC endpoints for networks
│
├── contracts/
│   ├── ZoningOracle.sol           # Hedera smart contract (Merkle root storage)
│   ├── deploy-hedera.js           # Deployment script
│   ├── write-to-hedera.js         # Write verification proof
│   ├── query-contract.js          # Query contract state
│   └── deployment.json            # Contract address + ABI
│
├── hedera-api/
│   ├── server.js                  # Express API server
│   ├── query-service.js           # Query logic (fetch + verify)
│   └── package.json               # API dependencies
│
├── run-oracle-automated.sh        # Complete automation script
└── README.md                      # This file
```

---

## Key Features

✅ **Decentralized Verification** - CRE sandboxed computation
✅ **Cryptographic Proofs** - Merkle tree verification
✅ **Immutable Audit Trail** - Historical snapshots on Hedera
✅ **Automated Updates** - Daily cron jobs via CRE
✅ **Multi-Chain** - Supabase + Chainlink + Hedera
✅ **Trustless Queries** - Users verify, don't trust
✅ **Real-World Data** - 1087 actual Durham County petitions
✅ **Scalable** - Merkle proofs scale to millions of records

---

## Production Deployment

To deploy to Chainlink DON (for live production):

1. **Request deployment access**:

```bash
cre account access
```

2. **Deploy workflow to DON**:

```bash
cre workflow deploy zoning-oracle --target production-settings
```

3. **Configure production settings**:

- Set production Supabase credentials
- Configure Hedera mainnet RPC
- Update smart contract to mainnet address

4. **The 5-node Chainlink network will**:

- Run OCR consensus
- Execute workflow in decentralized manner
- Update Hedera contract automatically

---

## Troubleshooting

### CRE Simulation Fails

- Check `simulation-latest.log` for errors
- Verify Supabase credentials in `config.staging.json`
- Ensure Supabase API is accessible
- Check network connectivity

### Hedera Write Fails

- Ensure you have testnet HBAR in your account
- Check `PRIVATE_KEY` in `.env` matches `EVM_ADDRESS`
- Verify contract address in `deployment.json`
- Check if you're the authorized oracle address

### API Server Issues

- Check port 3000 is not already in use: `lsof -ti:3000`
- Verify `deployment.json` exists with contract address
- Check `contracts/.env` has valid `PRIVATE_KEY`
- Review `server.log` for error messages

### Query Returns 404

- Ensure API server is running
- Check contract has at least one snapshot
- Verify petition number/PIN exists in Supabase

---

## Credits

- **Chainlink CRE**: Off-chain computation runtime with sandboxed execution
- **Hedera**: EVM-compatible L1 for verification proofs
- **Supabase**: PostgreSQL database with REST API
- **Durham County**: Open data source for zoning petitions

---

## License

MIT

---

## Contact & Support

For questions or issues:

- GitHub Issues: [Report a bug](https://github.com/yourusername/zoningoracle/issues)
- Documentation: See this README
- Chainlink CRE Docs: [CRE Documentation](https://docs.chain.link/cre)

---

**Built for Chainlink Constellation Hackathon 2026** 🚀
