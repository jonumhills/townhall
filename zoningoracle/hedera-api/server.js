#!/usr/bin/env node
/**
 * Hedera Oracle API Server
 * Receives verification data from CRE workflow and writes to Hedera contract
 */

const express = require('express');
const { ethers } = require('ethers');
const fs = require('fs');
const path = require('path');
const QueryService = require('./query-service');
require('dotenv').config({ path: path.join(__dirname, '../contracts/.env') });

const app = express();

// Enable CORS for browser access
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type');

  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }

  next();
});

app.use(express.json());

const PORT = process.env.PORT || 3000;

// Load contract deployment info
const deploymentPath = path.join(__dirname, 'deployment.json');
let deployment;

try {
  deployment = JSON.parse(fs.readFileSync(deploymentPath, 'utf8'));
} catch (error) {
  console.error('❌ Failed to load deployment.json');
  console.error('   Run: cd contracts && npm run deploy:hedera');
  process.exit(1);
}

const contractAddress = deployment.contractAddress;
const abi = deployment.abi;

// Setup Hedera connection
const privateKey = process.env.PRIVATE_KEY;
const rpcUrl = 'https://testnet.hashio.io/api';

if (!privateKey) {
  console.error('❌ Missing PRIVATE_KEY in contracts/.env');
  process.exit(1);
}

const provider = new ethers.JsonRpcProvider(rpcUrl);
const wallet = new ethers.Wallet(privateKey, provider);
const contract = new ethers.Contract(contractAddress, abi, wallet);

// Initialize Query Service with Supabase
const supabaseUrl = 'https://dhdqxsrgdurcuadmbypj.supabase.co';
const supabaseKey = process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRoZHF4c3JnZHVyY3VhZG1ieXBqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzAzMDA3NDUsImV4cCI6MjA4NTg3Njc0NX0.QxhgRS33CTDWWZvzmZ2Nv16mkLIPa4slPJ3_ZTcu3mU';
const queryService = new QueryService(contract, supabaseUrl, supabaseKey);

console.log('🚀 Hedera Oracle API Server');
console.log('='.repeat(70));
console.log(`📍 Contract: ${contractAddress}`);
console.log(`🔑 Signer: ${wallet.address}`);
console.log(`🌐 RPC: ${rpcUrl}`);
console.log(`🔌 Port: ${PORT}`);
console.log('='.repeat(70));

/**
 * POST /verify
 * Write verification proof to Hedera contract
 *
 * Body: {
 *   merkleRoot: string,
 *   petitionCount: number,
 *   dataHash: string
 * }
 */
app.post('/verify', async (req, res) => {
  const startTime = Date.now();

  try {
    const { merkleRoot, petitionCount, dataHash } = req.body;

    // Validate inputs
    if (!merkleRoot || !petitionCount || !dataHash) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: merkleRoot, petitionCount, dataHash'
      });
    }

    console.log('\n📝 New verification request:');
    console.log(`   Merkle Root: ${merkleRoot}`);
    console.log(`   Petition Count: ${petitionCount}`);
    console.log(`   Data Hash: ${dataHash}`);

    // Submit transaction to Hedera
    console.log('⏳ Submitting transaction to Hedera...');
    const tx = await contract.updateOracleData(merkleRoot, petitionCount, dataHash);

    console.log(`   Transaction sent: ${tx.hash}`);
    console.log('   Waiting for confirmation...');

    const receipt = await tx.wait();
    const duration = Date.now() - startTime;

    console.log(`✅ Merkle root written to Hedera! (${duration}ms)`);
    console.log(`   Block: ${receipt.blockNumber}`);
    console.log(`   Gas Used: ${receipt.gasUsed.toString()}`);

    // Return success response
    res.json({
      success: true,
      transaction: {
        hash: receipt.hash,
        blockNumber: receipt.blockNumber,
        gasUsed: receipt.gasUsed.toString(),
        timestamp: new Date().toISOString(),
        explorerUrl: `https://hashscan.io/testnet/transaction/${receipt.hash}`
      },
      data: {
        merkleRoot,
        petitionCount,
        dataHash
      },
      duration: `${duration}ms`
    });

  } catch (error) {
    console.error('❌ Transaction failed:', error.message);

    res.status(500).json({
      success: false,
      error: error.message,
      reason: error.reason || 'Unknown error'
    });
  }
});

/**
 * GET /status
 * Get latest verification data from contract
 */
app.get('/status', async (req, res) => {
  try {
    const snapshotCount = await contract.getSnapshotCount();

    if (snapshotCount > 0) {
      const [merkleRoot, timestamp, petitionCount, dataHash] = await contract.getLatestSnapshot();

      res.json({
        success: true,
        contract: contractAddress,
        totalSnapshots: snapshotCount.toString(),
        latestSnapshot: {
          merkleRoot,
          timestamp: new Date(Number(timestamp) * 1000).toISOString(),
          petitionCount: petitionCount.toString(),
          dataHash
        }
      });
    } else {
      res.json({
        success: true,
        contract: contractAddress,
        totalSnapshots: 0,
        message: 'No snapshots yet. Submit verification via POST /verify'
      });
    }

  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /query/:pin
 * Query parcel by PIN - returns verification details
 */
app.get('/query/:pin', async (req, res) => {
  try {
    const { pin } = req.params;

    if (!pin) {
      return res.status(400).json({
        success: false,
        error: 'Parcel PIN is required'
      });
    }

    console.log(`\n🔍 Query request for PIN: ${pin}`);

    const result = await queryService.queryByPin(pin);

    res.json({
      success: true,
      ...result
    });

  } catch (error) {
    console.error(`❌ Query failed for PIN ${req.params.pin}:`, error.message);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /history
 * Get snapshot history
 */
app.get('/history', async (req, res) => {
  try {
    const snapshots = await queryService.getSnapshotHistory();

    res.json({
      success: true,
      totalSnapshots: snapshots.length,
      snapshots
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /health
 * Health check endpoint
 */
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    contract: contractAddress,
    network: 'hedera-testnet',
    timestamp: new Date().toISOString()
  });
});

/**
 * GET /
 * API documentation
 */
app.get('/', (req, res) => {
  res.json({
    name: 'Hedera Oracle API',
    version: '3.0.0',
    description: 'Query verified zoning petition data from Hedera + Supabase with Merkle proofs',
    endpoints: {
      'GET /query/:pin': {
        description: 'Query parcel by PIN - returns petition, Merkle proof, and verification details',
        example: '/query/1234567890',
        response: 'Parcel info, petition details, Merkle proof, Hedera verification'
      },
      'GET /history': {
        description: 'Get snapshot history (last 10 verifications)'
      },
      'GET /status': {
        description: 'Get latest verification data from contract'
      },
      'POST /verify': {
        description: 'Write Merkle root to Hedera contract (internal use - CRE only)',
        body: {
          merkleRoot: 'string (0x... Merkle root)',
          petitionCount: 'number',
          dataHash: 'string (0x... hash)'
        }
      },
      'GET /health': {
        description: 'Health check'
      }
    },
    contract: contractAddress,
    network: 'hedera-testnet',
    explorer: `https://hashscan.io/testnet/contract/${contractAddress}`,
    examples: {
      queryParcel: `curl http://localhost:${PORT}/query/YOUR_PIN`,
      getHistory: `curl http://localhost:${PORT}/history`,
      getStatus: `curl http://localhost:${PORT}/status`
    }
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`\n✅ Server running on http://localhost:${PORT}`);
  console.log(`\n📋 Query Endpoints (for your application):`);
  console.log(`   GET    http://localhost:${PORT}/query/:pin    - Query parcel by PIN`);
  console.log(`   GET    http://localhost:${PORT}/history       - Get verification history`);
  console.log(`   GET    http://localhost:${PORT}/status        - Get latest snapshot`);
  console.log(`\n📋 Internal Endpoints:`);
  console.log(`   POST   http://localhost:${PORT}/verify        - Write to Hedera (CRE only)`);
  console.log(`   GET    http://localhost:${PORT}/health        - Health check`);
  console.log('\n');
});
