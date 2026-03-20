const { ethers } = require("ethers");
const axios = require("axios");
require("dotenv").config();

/**
 * Request testnet ADI tokens from the faucet for Durham County wallet
 */
async function fundFromFaucet() {
  console.log("\n========================================");
  console.log("ADI Chain Faucet - Auto Fund");
  console.log("========================================\n");

  const privateKey = process.env.DURHAM_PRIVATE_KEY;
  if (!privateKey) {
    throw new Error("DURHAM_PRIVATE_KEY not found in .env file");
  }

  const rpcUrl = process.env.ADI_RPC_URL || "https://rpc.ab.testnet.adifoundation.ai/";
  const faucetUrl = process.env.FAUCET_URL || "https://faucet.ab.testnet.adifoundation.ai/";

  // Connect to ADI testnet
  const provider = new ethers.JsonRpcProvider(rpcUrl);
  const wallet = new ethers.Wallet(privateKey, provider);

  console.log(`Wallet Address: ${wallet.address}\n`);

  try {
    // Check current balance
    const balanceBefore = await provider.getBalance(wallet.address);
    const balanceBeforeInADI = ethers.formatEther(balanceBefore);
    console.log(`Current Balance: ${balanceBeforeInADI} ADI\n`);

    // Request funds from faucet
    console.log("🚰 Requesting funds from faucet...");
    console.log(`Faucet URL: ${faucetUrl}\n`);

    try {
      // Try to call the faucet API
      // Note: Actual API endpoint format may vary - adjust as needed
      const response = await axios.post(`${faucetUrl}/api/claim`, {
        address: wallet.address
      }, {
        timeout: 30000,
        headers: {
          'Content-Type': 'application/json'
        }
      });

      console.log("✅ Faucet request successful!");
      console.log(`Response:`, response.data);
    } catch (faucetError) {
      if (faucetError.response) {
        console.log(`⚠️  Faucet API responded with error:`, faucetError.response.data);
      } else {
        console.log(`⚠️  Could not connect to faucet API automatically.`);
      }
      console.log("\n📝 Manual Steps:");
      console.log("1. Visit the faucet website:");
      console.log(`   ${faucetUrl}`);
      console.log("\n2. Enter your wallet address:");
      console.log(`   ${wallet.address}`);
      console.log("\n3. Complete the captcha and request funds");
      console.log("\n4. Wait ~30 seconds and run this script again to verify\n");
      return;
    }

    // Wait for transaction to be mined
    console.log("\n⏳ Waiting 10 seconds for transaction to be mined...");
    await new Promise(resolve => setTimeout(resolve, 10000));

    // Check new balance
    const balanceAfter = await provider.getBalance(wallet.address);
    const balanceAfterInADI = ethers.formatEther(balanceAfter);
    const difference = ethers.formatEther(balanceAfter - balanceBefore);

    console.log("\n========================================");
    console.log("Results:");
    console.log("========================================");
    console.log(`Balance Before: ${balanceBeforeInADI} ADI`);
    console.log(`Balance After:  ${balanceAfterInADI} ADI`);
    console.log(`Received:       ${difference} ADI\n`);

    if (balanceAfter > balanceBefore) {
      console.log("✅ Successfully funded from faucet!\n");
    } else {
      console.log("⚠️  Balance did not increase. Try again in a few moments.\n");
    }

    console.log("Block Explorer:");
    console.log(`https://explorer.ab.testnet.adifoundation.ai/address/${wallet.address}\n`);

  } catch (error) {
    console.error("❌ Error:", error.message);
    console.log("\nTroubleshooting:");
    console.log("1. Check your internet connection");
    console.log("2. Visit the faucet manually:");
    console.log(`   ${faucetUrl}`);
    console.log("3. Enter wallet address:");
    console.log(`   ${wallet.address}\n`);
    process.exit(1);
  }
}

fundFromFaucet()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("Fatal error:", error);
    process.exit(1);
  });
