import {
  TokenCreateTransaction,
  TokenType,
  TokenSupplyType,
  CustomRoyaltyFee,
  CustomFixedFee,
  Hbar,
} from "@hashgraph/sdk";
import { getClient, getOperatorKey, getOperatorId, getCountyAccount } from "./client.js";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DEPLOYED_PATH = path.join(__dirname, "deployed.json");

/**
 * Creates the NFT token type for a county.
 * Run ONCE per county — each parcel gets a serial number within this token.
 *
 * @param {string} countyId - e.g. "charlotte_nc"
 * @returns {Promise<{tokenId: string, explorerUrl: string}>}
 */
export async function createCountyNFTToken(countyId) {
  const client = getClient();
  const county = getCountyAccount(countyId);

  // 5% royalty on every secondary NFT sale — collector must be the treasury (county account)
  const royaltyFee = new CustomRoyaltyFee()
    .setNumerator(5)
    .setDenominator(100)
    .setFeeCollectorAccountId(county.id)
    .setFallbackFee(new CustomFixedFee().setHbarAmount(new Hbar(1)).setFeeCollectorAccountId(county.id));

  const tx = await new TokenCreateTransaction()
    .setTokenName(`Townhall Parcel Deed — ${countyId}`)
    .setTokenSymbol("THDEED")
    .setTokenType(TokenType.NonFungibleUnique)
    .setSupplyType(TokenSupplyType.Finite)
    .setMaxSupply(10000)
    .setTreasuryAccountId(county.id)     // ← county treasury, not operator
    .setAdminKey(county.key)             // ← county controls admin
    .setSupplyKey(county.key)            // ← county controls minting
    .setCustomFees([royaltyFee])
    .setMaxTransactionFee(new Hbar(30))
    .freezeWith(client)
    .sign(county.key);                   // ← county signs

  const response = await tx.execute(client);
  const receipt = await response.getReceipt(client);
  const tokenId = receipt.tokenId.toString();

  console.log(`NFT token created: ${tokenId} for county ${countyId}`);

  const deployed = loadDeployed();
  if (!deployed[countyId]) deployed[countyId] = {};
  deployed[countyId].nftTokenId = tokenId;
  deployed[countyId].nftCreatedAt = new Date().toISOString();
  saveDeployed(deployed);

  return {
    tokenId,
    explorerUrl: `https://hashscan.io/testnet/token/${tokenId}`,
  };
}

/**
 * Creates a fungible share token for a specific parcel.
 * Run once per parcel claim — 1000 shares issued to land owner.
 *
 * @param {string} pin - parcel PIN e.g. "12305310"
 * @param {string} ownerAccountId - Hedera account of land owner
 * @returns {Promise<{shareTokenId: string, explorerUrl: string}>}
 */
export async function createParcelShareToken(pin) {
  const client = getClient();
  const operatorKey = getOperatorKey();
  const operatorId = getOperatorId();

  const TOTAL_SHARES = 1000;

  const tx = await new TokenCreateTransaction()
    .setTokenName(`Townhall Parcel Shares — ${pin}`)
    .setTokenSymbol(`THPS-${pin}`)
    .setTokenType(TokenType.FungibleCommon)
    .setDecimals(0)
    .setInitialSupply(TOTAL_SHARES)
    .setSupplyType(TokenSupplyType.Finite)
    .setMaxSupply(TOTAL_SHARES)
    .setTreasuryAccountId(operatorId)   // operator holds initially
    .setAdminKey(operatorKey)
    .setSupplyKey(operatorKey)
    .setMaxTransactionFee(new Hbar(30))
    .freezeWith(client)
    .sign(operatorKey);

  const response = await tx.execute(client);
  const receipt = await response.getReceipt(client);
  const shareTokenId = receipt.tokenId.toString();

  console.log(`Share token created: ${shareTokenId} for parcel PIN ${pin}`);

  return {
    shareTokenId,
    totalShares: TOTAL_SHARES,
    explorerUrl: `https://hashscan.io/testnet/token/${shareTokenId}`,
  };
}

export function loadDeployed() {
  if (!fs.existsSync(DEPLOYED_PATH)) return {};
  return JSON.parse(fs.readFileSync(DEPLOYED_PATH, "utf8"));
}

function saveDeployed(data) {
  fs.writeFileSync(DEPLOYED_PATH, JSON.stringify(data, null, 2));
}
