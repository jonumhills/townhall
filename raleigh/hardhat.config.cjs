require("@nomicfoundation/hardhat-ethers");
require("dotenv").config();

/**
 * Hardhat config for deploying ZoningOracle to Hedera EVM.
 *
 * Hedera Testnet JSON-RPC relay: https://testnet.hashio.io/api
 * Chain ID: 296
 *
 * Your Hedera EVM private key is the HEX-encoded private key from the .env file.
 * (The same key you use for the Hedera SDK — just ensure it has 0x prefix.)
 */
module.exports = {
  solidity: {
    version: "0.8.20",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200,
      },
    },
  },

  networks: {
    hederaTestnet: {
      url: "https://testnet.hashio.io/api",
      chainId: 296,
      accounts: process.env.HEDERA_PRIVATE_KEY
        ? [process.env.HEDERA_PRIVATE_KEY]
        : [],
    },
    hederaMainnet: {
      url: "https://mainnet.hashio.io/api",
      chainId: 295,
      accounts: process.env.HEDERA_PRIVATE_KEY
        ? [process.env.HEDERA_PRIVATE_KEY]
        : [],
    },
  },

  paths: {
    sources:   "./contracts",
    tests:     "./test",
    cache:     "./cache",
    artifacts: "./artifacts",
  },
};
