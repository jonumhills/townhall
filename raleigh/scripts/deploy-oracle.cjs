/**
 * deploy-oracle.js
 *
 * Deploys ZoningOracle.sol to Hedera EVM testnet.
 *
 * Usage:
 *   cd raleigh
 *   npx hardhat run scripts/deploy-oracle.js --network hederaTestnet
 *
 * After deploying, copy the printed contract address into your .env:
 *   ZONING_ORACLE_ADDRESS=0x...
 */

const { ethers } = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
  const [deployer] = await ethers.getSigners();

  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("  Townhall ZoningOracle — Deployment");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log(`  Network  : ${network.name}`);
  console.log(`  Deployer : ${deployer.address}`);

  const balance = await ethers.provider.getBalance(deployer.address);
  console.log(`  Balance  : ${ethers.formatEther(balance)} HBAR\n`);

  if (balance === 0n) {
    console.error("ERROR: Deployer wallet has zero balance.");
    console.error("Fund it at https://portal.hedera.com (testnet faucet).");
    process.exit(1);
  }

  // Deploy
  console.log("Deploying ZoningOracle...");
  const ZoningOracle = await ethers.getContractFactory("ZoningOracle");
  const oracle = await ZoningOracle.deploy();
  await oracle.waitForDeployment();

  const address = await oracle.getAddress();

  console.log("\n✅ ZoningOracle deployed!");
  console.log(`   Contract address : ${address}`);
  console.log(`   Hashscan         : https://hashscan.io/testnet/contract/${address}`);
  console.log(`   Owner            : ${deployer.address}`);

  // Save to deployed.json
  const deployedPath = path.join(__dirname, "..", "deployed.json");
  let deployed = {};
  if (fs.existsSync(deployedPath)) {
    deployed = JSON.parse(fs.readFileSync(deployedPath, "utf8"));
  }

  deployed.zoningOracle = {
    address,
    network:   network.name,
    deployer:  deployer.address,
    deployedAt: new Date().toISOString(),
    hashscan: `https://hashscan.io/testnet/contract/${address}`,
  };

  fs.writeFileSync(deployedPath, JSON.stringify(deployed, null, 2));
  console.log(`\n   Saved to deployed.json`);

  console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("  Add to raleigh/.env:");
  console.log(`  ZONING_ORACLE_ADDRESS=${address}`);
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
