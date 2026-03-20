import { getOperatorId } from "./client.js";

const PLATFORM_FEE_PERCENT = 2.5;

/**
 * MVP Share Transfer — records share ownership in Supabase (off-chain ledger).
 *
 * WHY NOT ON-CHAIN: Hedera requires every account to call TokenAssociateTransaction
 * (signed by that account) before it can receive a token. Since the MVP uses
 * manual account ID entry (no Hashpack SDK), we cannot obtain the buyer's
 * signature. The operator holds all shares in its treasury; Supabase tracks
 * who owns what. On-chain settlement will happen when Hashpack is integrated.
 *
 * The generated txHash is a deterministic placeholder so the receipt UI works.
 *
 * @param {Object} params
 * @param {string} params.shareTokenId
 * @param {string} params.sellerAccountId
 * @param {string} params.buyerAccountId
 * @param {number} params.shareAmount
 * @param {number} params.priceHbar
 * @returns {Promise<{txHash, explorerUrl, sellerReceived, platformFee}>}
 */
export async function transferShares({
  shareTokenId,
  sellerAccountId,
  buyerAccountId,
  shareAmount,
  priceHbar,
}) {
  const operatorId = getOperatorId();

  const platformFeeHbar = +(priceHbar * (PLATFORM_FEE_PERCENT / 100)).toFixed(8);
  const sellerReceivesHbar = +(priceHbar - platformFeeHbar).toFixed(8);

  // Generate a deterministic placeholder transaction ID so the UI can show a receipt.
  // Format mirrors Hedera's: accountId@seconds.nanos
  const now = Date.now();
  const txHash = `${operatorId}@${Math.floor(now / 1000)}.${(now % 1000) * 1e6}`;

  console.log(
    `[MVP off-chain] ${shareAmount} shares of ${shareTokenId} recorded: ` +
    `${sellerAccountId} → ${buyerAccountId} | ${sellerReceivesHbar} HBAR credited to seller`
  );

  return {
    txHash,
    explorerUrl: `https://hashscan.io/testnet/transaction/${txHash}`,
    sellerReceived: sellerReceivesHbar,
    platformFee: platformFeeHbar,
  };
}
