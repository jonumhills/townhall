import {
  TokenMintTransaction,
  TokenId,
  Hbar,
} from "@hashgraph/sdk";
import { getClient, getOperatorKey, getOperatorId, getCountyAccount } from "./client.js";
import { loadDeployed, createParcelShareToken } from "./create-parcel-token.js";

/**
 * Full parcel mint — Option A:
 *   1. Mint NFT serial (deed) → stays in county treasury as deed record
 *   2. Create fungible share token (1000 shares) for this parcel
 *      → shares stay in operator treasury (no transfer — avoids TOKEN_NOT_ASSOCIATED_TO_ACCOUNT)
 *      → owner is recorded in Supabase; shares are transferred on listing/sale
 *
 * WHY NO TRANSFER: On Hedera every account must explicitly associate a token
 * before receiving it (TokenAssociateTransaction signed by that account).
 * Since the MVP uses account ID entry (no Hashpack), we cannot sign on behalf
 * of the owner. Shares stay in the operator and are marked as owner-reserved
 * in the token_registry table.
 *
 * @param {Object} params
 * @param {string} params.countyId       - e.g. "raleigh_nc"
 * @param {string} params.pin            - parcel petition number e.g. "Z-51-2024"
 * @param {string} params.ipfsCid        - IPFS CID (or hash placeholder) of metadata
 * @param {string} params.ownerAccountId - land owner Hedera account ID
 * @returns {Promise<{nftTokenId, serialNumber, shareTokenId, txHash, explorerUrls}>}
 */
export async function mintParcel({ countyId, pin, ipfsCid, ownerAccountId }) {
  const client = getClient();
  const operatorKey = getOperatorKey();
  const operatorId = getOperatorId();
  const county = getCountyAccount(countyId);

  const deployed = loadDeployed();
  if (!deployed[countyId]?.nftTokenId) {
    throw new Error(
      `No NFT token found for county ${countyId}. Run POST /token/create first.`
    );
  }

  const nftTokenId = TokenId.fromString(deployed[countyId].nftTokenId);

  // ── Step 1: Mint NFT serial — stays in county treasury as deed record ────
  const metadata = Buffer.from(`ipfs://${ipfsCid}`);

  const mintTx = await new TokenMintTransaction()
    .setTokenId(nftTokenId)
    .addMetadata(metadata)
    .setMaxTransactionFee(new Hbar(20))
    .freezeWith(client)
    .sign(county.key);               // county holds the supply key

  const mintResponse = await mintTx.execute(client);
  const mintReceipt = await mintResponse.getReceipt(client);
  const serialNumber = mintReceipt.serials[0].toNumber();

  console.log(`NFT minted: ${nftTokenId}#${serialNumber} for PIN ${pin}`);

  // ── Step 2: Create fungible share token — operator treasury holds all shares ─
  // Shares are NOT transferred to ownerAccountId here because the owner account
  // must first call TokenAssociateTransaction with their own signature before
  // receiving any token. In the MVP the owner does this via listing: when they
  // list shares for sale the operator (who already holds them) transfers them
  // to buyers, crediting the owner in Supabase.
  const { shareTokenId: shareTokenIdStr, totalShares } =
    await createParcelShareToken(pin);

  const txHash = mintResponse.transactionId.toString();

  console.log(
    `Share token ${shareTokenIdStr} created. ${totalShares} shares held by operator until listing.`
  );

  return {
    nftTokenId: nftTokenId.toString(),
    serialNumber,
    shareTokenId: shareTokenIdStr,
    totalShares,
    pin,
    ipfsCid,
    txHash,
    explorerUrls: {
      nft: `https://hashscan.io/testnet/token/${nftTokenId}/${serialNumber}`,
      shares: `https://hashscan.io/testnet/token/${shareTokenIdStr}`,
      tx: `https://hashscan.io/testnet/transaction/${txHash}`,
    },
  };
}
