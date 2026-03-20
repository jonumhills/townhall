require("@matterlabs/hardhat-zksync-deploy");
require("@matterlabs/hardhat-zksync-solc");
require("@matterlabs/hardhat-zksync-verify");
require("@nomicfoundation/hardhat-ethers");
require("dotenv").config();

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
  zksolc: {
    version: "1.5.0",
    compilerSource: "binary",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200,
      },
    },
  },
  defaultNetwork: "adiTestnet",
  networks: {
    hardhat: {
      zksync: false,
    },
    adiTestnet: {
      url: process.env.ADI_RPC_URL || "https://rpc.ab.testnet.adifoundation.ai/",
      ethNetwork: "sepolia", // Underlying L1 (zkSync requirement)
      chainId: 99999,
      zksync: true,
      verifyURL: "https://explorer.ab.testnet.adifoundation.ai/api/contract_verification",
      accounts: process.env.DURHAM_PRIVATE_KEY
        ? [process.env.DURHAM_PRIVATE_KEY]
        : [],
    },
  },
  solidity: {
    version: "0.8.20",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200,
      },
      viaIR: true,
    },
  },
  paths: {
    sources: "./contracts",
    tests: "./test",
    cache: "./cache-zk",
    artifacts: "./artifacts-zk",
  },
};
