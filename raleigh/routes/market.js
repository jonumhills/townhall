import { Router } from "express";
import { getSupabase } from "../supabase.js";
import { transferShares } from "../transfer-shares.js";

const router = Router();

// ─────────────────────────────────────────────────────────────────────────────
// POST /market/list
// Land owner lists their shares for sale at a given price.
// Shares stay in owner's wallet — listing is recorded in Supabase.
//
// Body: { pin, countyId, ownerAccountId, sharesAmount, priceHbar }
// ─────────────────────────────────────────────────────────────────────────────
router.post("/list", async (req, res) => {
  try {
    const { pin, countyId, ownerAccountId, sharesAmount, priceHbar } = req.body;

    if (!pin || !countyId || !ownerAccountId || !sharesAmount || !priceHbar) {
      return res.status(400).json({
        error: "pin, countyId, ownerAccountId, sharesAmount, priceHbar are required",
      });
    }

    const sb = getSupabase();

    // Verify token_registry entry exists and belongs to this owner
    const { data: token, error: tokenError } = await sb
      .from("token_registry")
      .select("*")
      .eq("pin", pin)
      .eq("county_id", countyId)
      .eq("owner_wallet", ownerAccountId)
      .single();

    if (tokenError || !token) {
      return res.status(404).json({
        error: "Parcel not found or you are not the owner",
      });
    }

    if (sharesAmount > token.available_shares) {
      return res.status(400).json({
        error: `Only ${token.available_shares} shares available to list`,
      });
    }

    // Update token_registry — mark as listed with price
    const { error: updateError } = await sb
      .from("token_registry")
      .update({
        listed: true,
        price_hbar: priceHbar,
        listed_shares: sharesAmount,
        listed_at: new Date().toISOString(),
      })
      .eq("pin", pin)
      .eq("county_id", countyId);

    if (updateError) throw updateError;

    res.json({
      success: true,
      pin,
      countyId,
      listed_shares: sharesAmount,
      price_hbar: priceHbar,
      share_token_id: token.share_token_id,
      message: `${sharesAmount} shares listed at ${priceHbar} HBAR each`,
    });
  } catch (err) {
    console.error("Error listing shares:", err);
    res.status(500).json({ error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /market/buy
// Buyer purchases shares from a listed parcel.
// Buyer must have already sent HBAR to operator wallet via Hashpack.
//
// Body: { pin, countyId, buyerAccountId, sharesAmount, txHashFromBuyer }
// ─────────────────────────────────────────────────────────────────────────────
router.post("/buy", async (req, res) => {
  try {
    const { pin, countyId, buyerAccountId, sharesAmount, txHashFromBuyer } =
      req.body;

    if (!pin || !countyId || !buyerAccountId || !sharesAmount) {
      return res.status(400).json({
        error: "pin, countyId, buyerAccountId, sharesAmount are required",
      });
    }

    const sb = getSupabase();

    // Fetch listing
    const { data: token, error: tokenError } = await sb
      .from("token_registry")
      .select("*")
      .eq("pin", pin)
      .eq("county_id", countyId)
      .eq("listed", true)
      .single();

    if (tokenError || !token) {
      return res.status(404).json({
        error: "Parcel not found or not listed for sale",
      });
    }

    if (sharesAmount > token.listed_shares) {
      return res.status(400).json({
        error: `Only ${token.listed_shares} shares available for purchase`,
      });
    }

    const totalPriceHbar = token.price_hbar * sharesAmount;

    // Transfer shares on Hedera
    const transferResult = await transferShares({
      shareTokenId: token.share_token_id,
      sellerAccountId: token.owner_wallet,
      buyerAccountId,
      shareAmount: sharesAmount,
      priceHbar: totalPriceHbar,
    });

    // Update token_registry — reduce available and listed shares
    const newAvailable = token.available_shares - sharesAmount;
    const newListed = token.listed_shares - sharesAmount;

    const { error: updateError } = await sb
      .from("token_registry")
      .update({
        available_shares: newAvailable,
        listed_shares: newListed,
        listed: newListed > 0,
      })
      .eq("pin", pin)
      .eq("county_id", countyId);

    if (updateError) console.error("Failed to update token_registry:", updateError);

    // Record the purchase in share_holdings
    const { error: holdingError } = await sb.from("share_holdings").insert({
      pin,
      county_id: countyId,
      blockchain_type: "hedera",
      share_token_id: token.share_token_id,
      buyer_wallet: buyerAccountId,
      shares_owned: sharesAmount,
      price_paid_hbar: totalPriceHbar,
      tx_hash: transferResult.txHash,
      buyer_tx_hash: txHashFromBuyer || null,
      purchased_at: new Date().toISOString(),
    });

    if (holdingError) console.error("Failed to insert share_holdings:", holdingError);

    res.json({
      success: true,
      pin,
      countyId,
      shares_purchased: sharesAmount,
      total_paid_hbar: totalPriceHbar,
      seller_received_hbar: transferResult.sellerReceived,
      platform_fee_hbar: transferResult.platformFee,
      tx_hash: transferResult.txHash,
      explorer_url: transferResult.explorerUrl,
      shares_remaining: newListed,
    });
  } catch (err) {
    console.error("Error buying shares:", err);
    res.status(500).json({ error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /market/listings
// Returns all parcels currently listed for sale.
// Optional query: ?countyId=charlotte_nc
// ─────────────────────────────────────────────────────────────────────────────
router.get("/listings", async (req, res) => {
  try {
    const { countyId } = req.query;
    const sb = getSupabase();

    let query = sb
      .from("token_registry")
      .select(
        "pin, county_id, share_token_id, nft_token_id, serial_number, total_shares, available_shares, listed_shares, owner_wallet, price_hbar, metadata, listed_at, created_at"
      )
      .eq("listed", true)
      .gt("listed_shares", 0);

    if (countyId) {
      query = query.eq("county_id", countyId);
    }

    const { data, error } = await query;
    if (error) throw error;

    res.json({ listings: data || [] });
  } catch (err) {
    console.error("Error fetching listings:", err);
    res.status(500).json({ error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /market/portfolio/:walletId
// Returns all share holdings for a wallet address.
// ─────────────────────────────────────────────────────────────────────────────
router.get("/portfolio/:walletId", async (req, res) => {
  try {
    const { walletId } = req.params;
    const sb = getSupabase();

    const { data, error } = await sb
      .from("share_holdings")
      .select(
        "pin, county_id, share_token_id, shares_owned, price_paid_hbar, tx_hash, purchased_at"
      )
      .eq("buyer_wallet", walletId);

    if (error) throw error;

    res.json({ portfolio: data || [] });
  } catch (err) {
    console.error("Error fetching portfolio:", err);
    res.status(500).json({ error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /market/owned/:walletId
// Returns all parcels owned (minted) by a wallet — from token_registry.
// Includes listing status, shares held, shares listed, shares sold.
// ─────────────────────────────────────────────────────────────────────────────
router.get("/owned/:walletId", async (req, res) => {
  try {
    const { walletId } = req.params;
    const sb = getSupabase();

    const { data, error } = await sb
      .from("token_registry")
      .select(
        "pin, county_id, nft_token_id, share_token_id, serial_number, total_shares, available_shares, listed_shares, owner_wallet, listed, price_hbar, listed_at, metadata, created_at"
      )
      .eq("owner_wallet", walletId);

    if (error) throw error;

    // Annotate each parcel with how many shares have been sold
    const enriched = (data || []).map((row) => ({
      ...row,
      shares_sold: row.total_shares - row.available_shares,
      can_list: row.available_shares,
    }));

    res.json({ owned: enriched });
  } catch (err) {
    console.error("Error fetching owned parcels:", err);
    res.status(500).json({ error: err.message });
  }
});

export default router;
