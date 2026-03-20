import { ethers } from "ethers";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Initialize provider
export const provider = new ethers.JsonRpcProvider(process.env.ADI_RPC_URL);

// Initialize admin wallet
export const adminWallet = new ethers.Wallet(
  process.env.DURHAM_PRIVATE_KEY,
  provider
);

// Load ABIs
const ABIS_PATH = path.join(__dirname, "../../abis/durham");

const parcelNFTABI = JSON.parse(
  fs.readFileSync(path.join(ABIS_PATH, "ParcelNFT.json"), "utf8")
);
const shareFactoryABI = JSON.parse(
  fs.readFileSync(path.join(ABIS_PATH, "ShareTokenFactory.json"), "utf8")
);
const shareTokenABI = JSON.parse(
  fs.readFileSync(path.join(ABIS_PATH, "ShareToken.json"), "utf8")
);
const marketplaceABI = JSON.parse(
  fs.readFileSync(path.join(ABIS_PATH, "Marketplace.json"), "utf8")
);

// Initialize contracts
export const parcelNFT = new ethers.Contract(
  process.env.PARCEL_NFT_ADDRESS,
  parcelNFTABI,
  adminWallet
);

export const shareFactory = new ethers.Contract(
  process.env.SHARE_TOKEN_FACTORY_ADDRESS,
  shareFactoryABI,
  adminWallet
);

export const marketplace = new ethers.Contract(
  process.env.MARKETPLACE_ADDRESS,
  marketplaceABI,
  adminWallet
);

// Helper to get ShareToken instance
export function getShareTokenContract(tokenAddress) {
  return new ethers.Contract(tokenAddress, shareTokenABI, adminWallet);
}

console.log("✅ ADI Chain contracts initialized");
console.log(`   ParcelNFT:   ${process.env.PARCEL_NFT_ADDRESS}`);
console.log(`   Factory:     ${process.env.SHARE_TOKEN_FACTORY_ADDRESS}`);
console.log(`   Marketplace: ${process.env.MARKETPLACE_ADDRESS}`);
