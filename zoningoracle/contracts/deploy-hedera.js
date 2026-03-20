#!/usr/bin/env node
/**
 * Deploy ZoningOracle contract to Hedera Testnet
 * Uses Hedera SDK for deployment
 */

const {
  Client,
  ContractCreateFlow,
  PrivateKey,
  Hbar,
  FileCreateTransaction,
  FileAppendTransaction
} = require("@hashgraph/sdk");
const fs = require("fs");
const solc = require("solc");

async function main() {
  console.log("🚀 Deploying ZoningOracle to Hedera Testnet...\n");

  // Get credentials from environment (.env file)
  require('dotenv').config();

  const operatorId = process.env.ACCOUNT_ID;
  const operatorKey = process.env.PRIVATE_KEY;
  const evmAddress = process.env.EVM_ADDRESS;

  if (!operatorId || !operatorKey) {
    throw new Error("Missing ACCOUNT_ID or PRIVATE_KEY in .env file");
  }

  // Create Hedera client
  const client = Client.forTestnet();
  client.setOperator(operatorId, PrivateKey.fromStringECDSA(operatorKey));
  client.setDefaultMaxTransactionFee(new Hbar(100));

  console.log(`📋 Deployer Account: ${operatorId}`);
  console.log(`🔑 Using private key: ${operatorKey.substring(0, 10)}...`);

  // Compile contract
  console.log("\n📦 Compiling ZoningOracle.sol...");
  const source = fs.readFileSync("./ZoningOracle.sol", "utf8");

  const input = {
    language: "Solidity",
    sources: {
      "ZoningOracle.sol": {
        content: source,
      },
    },
    settings: {
      outputSelection: {
        "*": {
          "*": ["abi", "evm.bytecode"],
        },
      },
    },
  };

  const output = JSON.parse(solc.compile(JSON.stringify(input)));

  if (output.errors) {
    output.errors.forEach((err) => {
      if (err.severity === "error") {
        console.error("❌ Compilation error:", err.formattedMessage);
      } else {
        console.warn("⚠️  Warning:", err.formattedMessage);
      }
    });
  }

  const contract = output.contracts["ZoningOracle.sol"]["ZoningOracle"];
  const bytecode = contract.evm.bytecode.object;
  const abi = contract.abi;

  console.log("✅ Contract compiled successfully");
  console.log(`   Bytecode size: ${bytecode.length / 2} bytes`);

  // Deploy contract using ContractCreateFlow
  console.log("\n🔨 Deploying to Hedera testnet...");

  // Oracle address from .env (this is the CRE workflow address)
  const oracleAddress = evmAddress;

  console.log(`   Oracle Address (CRE wallet): ${oracleAddress}`);

  try {
    const contractCreateTx = new ContractCreateFlow()
      .setGas(1000000)
      .setBytecode(bytecode)
      .setConstructorParameters(
        // Constructor parameter: address _oracleAddress
        Buffer.from(
          require("@ethersproject/abi").defaultAbiCoder.encode(
            ["address"],
            [oracleAddress]
          ).slice(2),
          "hex"
        )
      );

    const contractCreateSubmit = await contractCreateTx.execute(client);
    const contractCreateRx = await contractCreateSubmit.getReceipt(client);
    const contractId = contractCreateRx.contractId;
    const contractAddress = `0x${contractId.toSolidityAddress()}`;

    console.log("\n✅ CONTRACT DEPLOYED SUCCESSFULLY!");
    console.log("=".repeat(70));
    console.log(`📝 Contract ID: ${contractId}`);
    console.log(`📍 Contract Address: ${contractAddress}`);
    console.log(`🔐 Oracle Address: ${oracleAddress}`);
    console.log("=".repeat(70));

    // Save deployment info
    const deploymentInfo = {
      contractId: contractId.toString(),
      contractAddress: contractAddress,
      oracleAddress: oracleAddress,
      network: "hedera-testnet",
      deployedAt: new Date().toISOString(),
      deployerAccount: operatorId,
      abi: abi,
    };

    fs.writeFileSync(
      "./deployment.json",
      JSON.stringify(deploymentInfo, null, 2)
    );

    console.log("\n💾 Deployment info saved to deployment.json");
    console.log("\n📋 Next Steps:");
    console.log("1. Update config.staging.json with the contract address:");
    console.log(`   "oracleContractAddress": "${contractAddress}"`);
    console.log("\n2. Run the CRE workflow simulation:");
    console.log("   cre workflow simulate zoning-oracle --broadcast");

  } catch (error) {
    console.error("\n❌ Deployment failed:", error.message);
    if (error.status) {
      console.error("   Status:", error.status.toString());
    }
    process.exit(1);
  }

  client.close();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
