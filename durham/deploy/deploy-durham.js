const { Deployer } = require("@matterlabs/hardhat-zksync-deploy");
const { Wallet } = require("zksync-ethers");
const hre = require("hardhat");
const fs = require("fs");
const path = require("path");

/**
 * Deploy Durham County smart contracts to ADI Chain
 *
 * This script deploys:
 * 1. ParcelNFT - ERC-721 for property deeds
 * 2. ShareTokenFactory - Factory for creating ERC-20 share tokens
 * 3. Marketplace - DEX for buying/selling shares
 */
async function main() {
  console.log("\n========================================");
  console.log("Durham County Smart Contract Deployment");
  console.log("Network: ADI Chain Testnet");
  console.log("========================================\n");

  // Get private key from environment
  const privateKey = process.env.DURHAM_PRIVATE_KEY;
  if (!privateKey) {
    throw new Error("DURHAM_PRIVATE_KEY not found in .env file");
  }

  // Initialize wallet and deployer
  const wallet = new Wallet(privateKey);
  const deployer = new Deployer(hre, wallet);

  const countyAdminAddress = wallet.address;
  const platformWallet = process.env.PLATFORM_WALLET || wallet.address;

  console.log(`Deployer address: ${wallet.address}`);
  console.log(`County Admin: ${countyAdminAddress}`);
  console.log(`Platform Wallet: ${platformWallet}\n`);

  // Check balance
  const balance = await wallet.getBalance();
  console.log(`Wallet balance: ${hre.ethers.formatEther(balance)} ADI\n`);

  if (balance === 0n) {
    throw new Error(
      "Insufficient ADI balance. Please get testnet tokens from: https://faucet.ab.testnet.adifoundation.ai/"
    );
  }

  const deploymentResults = {
    network: "ADI Testnet",
    chainId: 99999,
    deployer: wallet.address,
    countyAdmin: countyAdminAddress,
    platformWallet: platformWallet,
    timestamp: new Date().toISOString(),
    contracts: {},
  };

  // 1. Deploy ParcelNFT
  console.log("📝 Deploying ParcelNFT...");
  const ParcelNFT = await deployer.loadArtifact("ParcelNFT");
  const parcelNFT = await deployer.deploy(ParcelNFT, [countyAdminAddress]);
  await parcelNFT.waitForDeployment();
  const parcelNFTAddress = await parcelNFT.getAddress();

  console.log(`✅ ParcelNFT deployed to: ${parcelNFTAddress}`);
  console.log(
    `   Explorer: https://explorer.ab.testnet.adifoundation.ai/address/${parcelNFTAddress}\n`
  );

  deploymentResults.contracts.ParcelNFT = {
    address: parcelNFTAddress,
    constructorArgs: [countyAdminAddress],
  };

  // 2. Deploy ShareTokenFactory
  console.log("🏭 Deploying ShareTokenFactory...");
  const ShareTokenFactory = await deployer.loadArtifact("ShareTokenFactory");
  const shareTokenFactory = await deployer.deploy(ShareTokenFactory, [
    countyAdminAddress,
    parcelNFTAddress,
  ]);
  await shareTokenFactory.waitForDeployment();
  const shareTokenFactoryAddress = await shareTokenFactory.getAddress();

  console.log(`✅ ShareTokenFactory deployed to: ${shareTokenFactoryAddress}`);
  console.log(
    `   Explorer: https://explorer.ab.testnet.adifoundation.ai/address/${shareTokenFactoryAddress}\n`
  );

  deploymentResults.contracts.ShareTokenFactory = {
    address: shareTokenFactoryAddress,
    constructorArgs: [countyAdminAddress, parcelNFTAddress],
  };

  // 3. Deploy Marketplace
  console.log("🏪 Deploying Marketplace...");
  const Marketplace = await deployer.loadArtifact("Marketplace");
  const marketplace = await deployer.deploy(Marketplace, [platformWallet]);
  await marketplace.waitForDeployment();
  const marketplaceAddress = await marketplace.getAddress();

  console.log(`✅ Marketplace deployed to: ${marketplaceAddress}`);
  console.log(
    `   Explorer: https://explorer.ab.testnet.adifoundation.ai/address/${marketplaceAddress}\n`
  );

  deploymentResults.contracts.Marketplace = {
    address: marketplaceAddress,
    constructorArgs: [platformWallet],
  };

  // Save deployment results
  const resultsPath = path.join(__dirname, "..", "deployed-addresses.json");
  fs.writeFileSync(resultsPath, JSON.stringify(deploymentResults, null, 2));

  console.log("========================================");
  console.log("✅ Deployment Complete!");
  console.log("========================================\n");

  console.log("Contract Addresses:");
  console.log(`ParcelNFT:         ${parcelNFTAddress}`);
  console.log(`ShareTokenFactory: ${shareTokenFactoryAddress}`);
  console.log(`Marketplace:       ${marketplaceAddress}\n`);

  console.log("Next steps:");
  console.log("1. Update your .env file with these addresses");
  console.log("2. Run: npm run extract-abis");
  console.log("3. Test minting: npm run test-mint\n");

  console.log(`Deployment details saved to: ${resultsPath}\n`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("❌ Deployment failed:", error);
    process.exit(1);
  });
