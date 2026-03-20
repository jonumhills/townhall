/**
 * oracle-push.js
 *
 * Reads verified parcel data from Supabase and pushes zoning scores
 * to the ZoningOracle smart contract on Hedera EVM.
 *
 * Run manually:         node scripts/oracle-push.js
 * Run for single PIN:   node scripts/oracle-push.js --pin 171820
 * Run in watch mode:    node scripts/oracle-push.js --watch
 *
 * Requires in .env:
 *   HEDERA_PRIVATE_KEY, ZONING_ORACLE_ADDRESS, SUPABASE_URL, SUPABASE_KEY
 */

import { ethers }      from "ethers";
import { createClient } from "@supabase/supabase-js";
import dotenv          from "dotenv";
import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

dotenv.config();

const __dirname = dirname(fileURLToPath(import.meta.url));

// ── Config ────────────────────────────────────────────────────────────────────
const HEDERA_RPC          = "https://testnet.hashio.io/api";
const ORACLE_ADDRESS      = process.env.ZONING_ORACLE_ADDRESS;
const PRIVATE_KEY         = process.env.HEDERA_PRIVATE_KEY;
const WATCH_INTERVAL_MS   = 5 * 60 * 1000; // 5 minutes
const BATCH_SIZE          = 20;             // parcels per tx

// ── Zoning score algorithm ────────────────────────────────────────────────────
// Mirrors the plan discussed — computes a 0-100 score from petition data.
const ZONING_RANKS = {
  'AG': -4, 'EX': -4, 'CON': -4, 'OS': -3,
  'R-40': -2, 'R-20': -1, 'R-10': 0, 'R-6': 1, 'R-4': 2,
  'RX': 2, 'NX': 3, 'OX': 3, 'TOD': 4, 'CX': 4, 'DX': 5,
  'IX': -1, 'IH': -2,
};

function computeZoningScore(parcel) {
  let score = 50; // baseline

  // +/- based on zoning classification
  const code = (parcel.current_zoning || '').toUpperCase().split(' ')[0];
  const rank = ZONING_RANKS[code] ?? 0;
  score += rank * 5; // each rank step = ±5 pts

  // Document completeness: +10 if legislation_url present
  if (parcel.legislation_url) score += 10;

  // No active rezoning: +15 if no proposed zoning change
  if (!parcel.proposed_zoning || parcel.proposed_zoning === parcel.current_zoning) {
    score += 15;
  } else {
    score -= 10; // active rezoning = risk
  }

  // Vote result signals
  if (parcel.vote_result) {
    const v = parcel.vote_result.toLowerCase();
    if (v.includes('approved') || v.includes('passed'))  score += 10;
    if (v.includes('denied')   || v.includes('rejected')) score -= 15;
    if (v.includes('withdrawn'))                          score -= 5;
  }

  // Status signals
  if (parcel.status) {
    const s = parcel.status.toLowerCase();
    if (s === 'approved') score += 5;
    if (s === 'denied')   score -= 10;
    if (s === 'pending')  score -= 5;
  }

  return Math.max(0, Math.min(100, score));
}

// ── ABI (only the functions we need) ─────────────────────────────────────────
const ORACLE_ABI = [
  "function updateParcel(string pin, string zoningCode, uint8 score, bytes32 merkleRoot) external",
  "function batchUpdateParcels(string[] pins, string[] zoningCodes, uint8[] scores, bytes32 merkleRoot) external",
  "function getZoningScore(string pin) external view returns (uint8 score, bool verified, uint256 updatedAt)",
  "event ParcelUpdated(string indexed pin, string zoningCode, uint8 score, bytes32 merkleRoot, uint256 updatedAt)",
];

// ── Helpers ───────────────────────────────────────────────────────────────────
function validateEnv() {
  const missing = ['HEDERA_PRIVATE_KEY', 'ZONING_ORACLE_ADDRESS', 'SUPABASE_URL', 'SUPABASE_KEY']
    .filter(k => !process.env[k]);
  if (missing.length) {
    console.error(`Missing env vars: ${missing.join(', ')}`);
    process.exit(1);
  }
}

function getMerkleRoot() {
  // Read from the oracle Express server's latest snapshot if available,
  // otherwise use a zero bytes32 as placeholder.
  try {
    const snap = JSON.parse(readFileSync(resolve(__dirname, '../../oracle-snapshot.json'), 'utf8'));
    return snap.merkleRoot || ethers.ZeroHash;
  } catch {
    return ethers.ZeroHash;
  }
}

// ── Main push logic ───────────────────────────────────────────────────────────
async function pushToContract(parcels, contract, merkleRoot) {
  if (parcels.length === 0) {
    console.log("No parcels to push.");
    return;
  }

  // Process in batches
  for (let i = 0; i < parcels.length; i += BATCH_SIZE) {
    const batch = parcels.slice(i, i + BATCH_SIZE);

    const pins        = batch.map(p => String(p.pin));
    const zoningCodes = batch.map(p => p.current_zoning || 'UNKNOWN');
    const scores      = batch.map(p => computeZoningScore(p));

    console.log(`\nPushing batch ${Math.floor(i / BATCH_SIZE) + 1} (${batch.length} parcels)...`);
    batch.forEach((p, idx) => {
      console.log(`  PIN ${pins[idx]} → zone: ${zoningCodes[idx]}, score: ${scores[idx]}`);
    });

    try {
      const tx = await contract.batchUpdateParcels(pins, zoningCodes, scores, merkleRoot);
      console.log(`  TX submitted: ${tx.hash}`);
      const receipt = await tx.wait();
      console.log(`  ✅ Confirmed in block ${receipt.blockNumber}`);
      console.log(`  Hashscan: https://hashscan.io/testnet/transaction/${tx.hash}`);
    } catch (err) {
      console.error(`  ❌ Batch failed: ${err.message}`);
      // Fall back to individual updates
      for (let j = 0; j < batch.length; j++) {
        try {
          const tx = await contract.updateParcel(pins[j], zoningCodes[j], scores[j], merkleRoot);
          await tx.wait();
          console.log(`  ✅ Individual update OK: PIN ${pins[j]}`);
        } catch (e) {
          console.error(`  ❌ Failed PIN ${pins[j]}: ${e.message}`);
        }
      }
    }
  }
}

async function run(targetPin) {
  validateEnv();

  const provider = new ethers.JsonRpcProvider(HEDERA_RPC);
  const wallet   = new ethers.Wallet(PRIVATE_KEY, provider);
  const contract = new ethers.Contract(ORACLE_ADDRESS, ORACLE_ABI, wallet);
  const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("  Townhall Oracle Push");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log(`  Oracle contract : ${ORACLE_ADDRESS}`);
  console.log(`  Wallet          : ${wallet.address}`);
  console.log(`  Network         : Hedera Testnet\n`);

  const merkleRoot = getMerkleRoot();
  console.log(`  Merkle root     : ${merkleRoot}`);

  // Query Supabase for parcels
  let query = supabase.from("petitions").select("*");
  if (targetPin) {
    query = query.eq("pin", targetPin);
    console.log(`  Mode            : single PIN ${targetPin}\n`);
  } else {
    console.log(`  Mode            : all parcels\n`);
  }

  const { data: parcels, error } = await query;
  if (error) {
    console.error("Supabase error:", error.message);
    process.exit(1);
  }

  console.log(`  Found ${parcels.length} parcel(s) in Supabase`);
  await pushToContract(parcels, contract, merkleRoot);

  console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("  Done.");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");
}

// ── Entry point ───────────────────────────────────────────────────────────────
const args    = process.argv.slice(2);
const pinArg  = args.includes('--pin')   ? args[args.indexOf('--pin')   + 1] : null;
const watch   = args.includes('--watch');

if (watch) {
  console.log(`Watch mode: pushing every ${WATCH_INTERVAL_MS / 60000} minutes\n`);
  run(null);
  setInterval(() => run(null), WATCH_INTERVAL_MS);
} else {
  run(pinArg);
}
