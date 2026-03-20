require("@nomicfoundation/hardhat-ethers");
require("dotenv").config();

/** @type import('hardhat/config').HardhatUserConfig */
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
    adiTestnet: {
      url: process.env.ADI_RPC_URL || "https://rpc.ab.testnet.adifoundation.ai/",
      chainId: 99999,
      accounts: process.env.DURHAM_PRIVATE_KEY
        ? [process.env.DURHAM_PRIVATE_KEY]
        : [],
    },
  },
  paths: {
    sources: "./contracts",
    tests: "./test",
    cache: "./cache",
    artifacts: "./artifacts",
  },
};
