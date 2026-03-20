const fs = require("fs");
const path = require("path");

/**
 * Extract ABIs from compiled artifacts and copy to backend
 *
 * This script extracts the JSON ABIs for:
 * - ParcelNFT
 * - ShareTokenFactory
 * - ShareToken
 * - Marketplace
 *
 * And copies them to: ../abis/durham/
 */

const ARTIFACTS_DIR = path.join(__dirname, "..", "artifacts");
const OUTPUT_DIR = path.join(__dirname, "..", "abis", "durham");

const CONTRACTS = [
  {
    name: "ParcelNFT",
    path: "contracts/ParcelNFT.sol/ParcelNFT.json",
  },
  {
    name: "ShareTokenFactory",
    path: "contracts/ShareTokenFactory.sol/ShareTokenFactory.json",
  },
  {
    name: "ShareToken",
    path: "contracts/ShareTokenFactory.sol/ShareToken.json",
  },
  {
    name: "Marketplace",
    path: "contracts/Marketplace.sol/Marketplace.json",
  },
];

async function extractABIs() {
  console.log("\n========================================");
  console.log("Extracting ABIs for Durham County");
  console.log("========================================\n");

  // Create output directory if it doesn't exist
  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
    console.log(`✅ Created directory: ${OUTPUT_DIR}\n`);
  }

  // Extract each contract's ABI
  for (const contract of CONTRACTS) {
    const artifactPath = path.join(ARTIFACTS_DIR, contract.path);

    if (!fs.existsSync(artifactPath)) {
      console.log(`⚠️  Artifact not found: ${contract.name}`);
      console.log(`   Expected: ${artifactPath}`);
      console.log(`   Run 'npm run compile' first\n`);
      continue;
    }

    // Read artifact
    const artifact = JSON.parse(fs.readFileSync(artifactPath, "utf8"));

    // Extract ABI
    const abi = artifact.abi;

    // Write ABI to output directory
    const outputPath = path.join(OUTPUT_DIR, `${contract.name}.json`);
    fs.writeFileSync(outputPath, JSON.stringify(abi, null, 2));

    console.log(`✅ Extracted: ${contract.name}`);
    console.log(`   → ${outputPath}`);
  }

  // Also copy deployment addresses if available
  const deployedPath = path.join(__dirname, "..", "deployed-addresses.json");
  if (fs.existsSync(deployedPath)) {
    const addressesOutputPath = path.join(OUTPUT_DIR, "deployed-addresses.json");
    fs.copyFileSync(deployedPath, addressesOutputPath);
    console.log(`\n✅ Copied deployment addresses`);
    console.log(`   → ${addressesOutputPath}`);
  }

  console.log("\n========================================");
  console.log("✅ ABI Extraction Complete!");
  console.log("========================================\n");

  console.log("ABIs are now available for backend integration:");
  console.log(`${OUTPUT_DIR}/\n`);
}

extractABIs()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("❌ ABI extraction failed:", error);
    process.exit(1);
  });
