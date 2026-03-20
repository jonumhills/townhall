import express from "express";
import { supabase } from "../config/supabase.js";
import { getShareTokenContract } from "../config/contracts.js";
import {
  isValidAddress,
  isValidPin,
  isValidAdiAmount,
  isValidShareAmount,
  sanitizeError,
} from "../utils/validation.js";
import dotenv from "dotenv";

dotenv.config();

const router = express.Router();
const PLATFORM_FEE_PERCENT = parseFloat(process.env.PLATFORM_FEE_PERCENT) || 2.5;

// ══════════════════════════════════════════════════════════════════
// POST /market/list
// List shares for sale
// ══════════════════════════════════════════════════════════════════
router.post("/list", async (req, res) => {
  try {
    const { pin, countyId, ownerAccountId, sharesAmount, priceAdi } = req.body;

    // Validate inputs
    if (!isValidPin(pin) || countyId !== "durham_nc") {
      return res.status(400).json({ error: "Invalid PIN or county ID" });
    }

    if (!isValidAddress(ownerAccountId)) {
      return res.status(400).json({ error: "Invalid Ethereum address" });
    }

    if (!isValidShareAmount(sharesAmount)) {
      return res.status(400).json({ error: "Invalid share amount (1-1000)" });
    }

    if (!isValidAdiAmount(priceAdi)) {
      return res.status(400).json({ error: "Invalid price in ADI" });
    }

    // Get token registry entry
    const { data: tokenData, error: tokenError } = await supabase
      .from("token_registry")
      .select("*")
      .eq("pin", pin)
      .eq("county_id", countyId)
      .eq("blockchain_type", "adi")
      .eq("verification_status", "approved")
      .single();

    if (tokenError || !tokenData) {
      return res.status(404).json({ error: "Parcel not found or not minted" });
    }

    // Verify ownership
    if (tokenData.owner_wallet.toLowerCase() !== ownerAccountId.toLowerCase()) {
      return res.status(403).json({ error: "Not the parcel owner" });
    }

    // Check available shares
    if (tokenData.available_shares < sharesAmount) {
      return res.status(400).json({
        error: "Insufficient available shares",
        available: tokenData.available_shares,
        requested: sharesAmount,
      });
    }

    // Update listing
    const { error: updateError } = await supabase
      .from("token_registry")
      .update({
        listed: true,
        price_adi: priceAdi,
        listed_shares: sharesAmount,
        listed_at: new Date().toISOString(),
      })
      .eq("id", tokenData.id);

    if (updateError) throw updateError;

    res.json({
      success: true,
      message: "Shares listed successfully",
      listing: {
        pin,
        shareTokenAddress: tokenData.share_token_id,
        sharesAmount,
        pricePerShare: priceAdi,
        totalValue: sharesAmount * priceAdi,
      },
    });
  } catch (error) {
    console.error("Error listing shares:", error);
    res.status(500).json({ error: sanitizeError(error) });
  }
});

// ══════════════════════════════════════════════════════════════════
// POST /market/buy
// Purchase shares (MVP: off-chain ledger)
// ══════════════════════════════════════════════════════════════════
router.post("/buy", async (req, res) => {
  try {
    const { pin, countyId, buyerAccountId, sharesAmount, txHashFromBuyer } = req.body;

    // Validate inputs
    if (!isValidPin(pin) || countyId !== "durham_nc") {
      return res.status(400).json({ error: "Invalid PIN or county ID" });
    }

    if (!isValidAddress(buyerAccountId)) {
      return res.status(400).json({ error: "Invalid buyer address" });
    }

    if (!isValidShareAmount(sharesAmount)) {
      return res.status(400).json({ error: "Invalid share amount" });
    }

    // Get listing
    const { data: tokenData, error: tokenError } = await supabase
      .from("token_registry")
      .select("*")
      .eq("pin", pin)
      .eq("county_id", countyId)
      .eq("blockchain_type", "adi")
      .eq("listed", true)
      .single();

    if (tokenError || !tokenData) {
      return res.status(404).json({ error: "Listing not found" });
    }

    // Check if buyer is trying to buy their own shares
    if (tokenData.owner_wallet.toLowerCase() === buyerAccountId.toLowerCase()) {
      return res.status(400).json({ error: "Cannot buy your own shares" });
    }

    // Check available shares
    if (tokenData.listed_shares < sharesAmount) {
      return res.status(400).json({
        error: "Insufficient shares available",
        available: tokenData.listed_shares,
        requested: sharesAmount,
      });
    }

    // Calculate prices
    const pricePerShare = tokenData.price_adi;
    const totalPrice = sharesAmount * pricePerShare;
    const platformFee = Math.round((totalPrice * PLATFORM_FEE_PERCENT) / 100);
    const sellerReceives = totalPrice - platformFee;

    // MVP: Create off-chain transaction record
    // Production: Execute on-chain ERC-20 transfer
    const { data: holding, error: holdingError } = await supabase
      .from("share_holdings")
      .insert({
        pin,
        county_id: countyId,
        blockchain_type: "adi",
        share_token_id: tokenData.share_token_id,
        buyer_wallet: buyerAccountId,
        shares_owned: sharesAmount,
        price_paid_adi: totalPrice,
        tx_hash: txHashFromBuyer || `offchain-${Date.now()}-${Math.random().toString(36)}`,
        buyer_tx_hash: txHashFromBuyer,
        purchased_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (holdingError) {
      console.error("Holding insert error:", holdingError);
      throw holdingError;
    }

    // Update token registry
    const newAvailableShares = tokenData.available_shares - sharesAmount;
    const newListedShares = tokenData.listed_shares - sharesAmount;

    const { error: updateError } = await supabase
      .from("token_registry")
      .update({
        available_shares: newAvailableShares,
        listed_shares: newListedShares,
        listed: newListedShares > 0, // Unlist if all shares sold
      })
      .eq("id", tokenData.id);

    if (updateError) throw updateError;

    res.json({
      success: true,
      message: "Shares purchased successfully",
      purchase: {
        pin,
        sharesPurchased: sharesAmount,
        pricePerShare,
        totalPaid: totalPrice,
        platformFee,
        sellerReceives,
        shareToken: tokenData.share_token_id,
        txHash: holding.tx_hash,
        explorerUrl: `${process.env.ADI_EXPLORER_URL}/address/${tokenData.share_token_id}`,
      },
      remainingListed: newListedShares,
    });
  } catch (error) {
    console.error("Error buying shares:", error);
    res.status(500).json({ error: sanitizeError(error) });
  }
});

// ══════════════════════════════════════════════════════════════════
// GET /market/listings
// Get all active share listings
// ══════════════════════════════════════════════════════════════════
router.get("/listings", async (req, res) => {
  try {
    const { data: listings, error } = await supabase
      .from("token_registry")
      .select("*")
      .eq("county_id", "durham_nc")
      .eq("blockchain_type", "adi")
      .eq("listed", true)
      .gt("listed_shares", 0)
      .order("listed_at", { ascending: false });

    if (error) throw error;

    res.json({
      success: true,
      listings: listings || [],
      count: listings?.length || 0,
    });
  } catch (error) {
    console.error("Error fetching listings:", error);
    res.status(500).json({ error: sanitizeError(error) });
  }
});

// ══════════════════════════════════════════════════════════════════
// GET /market/portfolio/:wallet
// Get shares purchased by a wallet
// ══════════════════════════════════════════════════════════════════
router.get("/portfolio/:wallet", async (req, res) => {
  try {
    const { wallet } = req.params;

    if (!isValidAddress(wallet)) {
      return res.status(400).json({ error: "Invalid wallet address" });
    }

    const { data: holdings, error } = await supabase
      .from("share_holdings")
      .select("*")
      .eq("county_id", "durham_nc")
      .eq("buyer_wallet", wallet)
      .order("purchased_at", { ascending: false });

    if (error) throw error;

    // Calculate totals
    const totalShares = holdings?.reduce((sum, h) => sum + h.shares_owned, 0) || 0;
    const totalInvested = holdings?.reduce((sum, h) => sum + h.price_paid_adi, 0) || 0;

    res.json({
      success: true,
      wallet,
      portfolio: holdings || [], // Match Hedera API format
      summary: {
        totalHoldings: holdings?.length || 0,
        totalShares,
        totalInvestedAdi: totalInvested,
      },
    });
  } catch (error) {
    console.error("Error fetching portfolio:", error);
    res.status(500).json({ error: sanitizeError(error) });
  }
});

// ══════════════════════════════════════════════════════════════════
// GET /market/owned/:wallet
// Get parcels owned/minted by a wallet
// ══════════════════════════════════════════════════════════════════
router.get("/owned/:wallet", async (req, res) => {
  try {
    const { wallet } = req.params;

    if (!isValidAddress(wallet)) {
      return res.status(400).json({ error: "Invalid wallet address" });
    }

    const { data: owned, error } = await supabase
      .from("token_registry")
      .select("*")
      .eq("county_id", "durham_nc")
      .eq("blockchain_type", "adi")
      .eq("owner_wallet", wallet)
      .eq("verification_status", "approved")
      .order("verified_at", { ascending: false });

    if (error) throw error;

    res.json({
      success: true,
      wallet,
      owned: owned || [],
      count: owned?.length || 0,
    });
  } catch (error) {
    console.error("Error fetching owned parcels:", error);
    res.status(500).json({ error: sanitizeError(error) });
  }
});

export default router;
