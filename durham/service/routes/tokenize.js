import express from "express";
import { supabase } from "../config/supabase.js";
import { mintParcel } from "../lib/mint-parcel.js";
import { estimateParcelValue } from "../lib/pricing.js";
import {
  isValidAddress,
  isValidPin,
  isValidCountyId,
  sanitizeError,
} from "../utils/validation.js";

const router = express.Router();

// ══════════════════════════════════════════════════════════════════
// POST /token/verify-deed
// Check if parcel exists and is available for claiming
// ══════════════════════════════════════════════════════════════════
router.post("/verify-deed", async (req, res) => {
  try {
    const { pin, countyId, ownerAccountId } = req.body;

    // Validate inputs
    if (!isValidPin(pin)) {
      return res.status(400).json({ error: "Invalid PIN format" });
    }

    if (countyId !== "durham_nc") {
      return res.status(400).json({ error: "Invalid county ID for Durham service" });
    }

    if (!isValidAddress(ownerAccountId)) {
      return res.status(400).json({ error: "Invalid Ethereum address" });
    }

    // Check if parcel exists in database
    const { data: parcelData, error: parcelError } = await supabase
      .from("parcels")
      .select("*")
      .eq("pin", pin)
      .eq("county_id", countyId)
      .single();

    if (parcelError || !parcelData) {
      return res.status(404).json({
        error: "Parcel not found",
        message: `PIN ${pin} not found in Durham County registry`,
      });
    }

    // Check if already tokenized
    const { data: existingToken } = await supabase
      .from("token_registry")
      .select("*")
      .eq("pin", pin)
      .eq("county_id", countyId)
      .eq("blockchain_type", "adi")
      .single();

    if (existingToken) {
      return res.status(409).json({
        error: "Already tokenized",
        message: "This parcel has already been minted as an NFT",
        tokenData: existingToken,
      });
    }

    // Extract petition info from properties JSON or fetch from petitions table
    // Durham parcels have petition info embedded in properties field
    const props = parcelData.properties || {};
    const areaSqft = props.area_sqft || 0;
    const zoningCode = props.proposed_zoning || props.current_zoning;

    const valuation = estimateParcelValue(zoningCode, areaSqft);

    // Return parcel details (format similar to Hedera but adapted for Durham data)
    res.json({
      success: true,
      canClaim: true,
      parcel: {
        pin: parcelData.pin,
        parcel_id: parcelData.parcel_id,
        county_id: countyId,
        address: props.address || props.location,
        location: props.location,
        areaSqft: areaSqft,
        geometry: parcelData.geometry,
      },
      petition: {
        petition_number: parcelData.petition_number || props.petition_number,
        current_zoning: props.current_zoning,
        proposed_zoning: props.proposed_zoning,
        location: props.location,
        address: props.address,
        petitioner: props.petitioner,
        status: props.status,
        meeting_date: props.meeting_date,
        vote_result: props.vote_result,
      },
      valuation,
    });
  } catch (error) {
    console.error("Error verifying deed:", error);
    res.status(500).json({ error: sanitizeError(error) });
  }
});

// ══════════════════════════════════════════════════════════════════
// POST /token/submit-claim
// Submit deed claim for county admin review
// ══════════════════════════════════════════════════════════════════
router.post("/submit-claim", async (req, res) => {
  try {
    const { pin, countyId, ownerAccountId, priceAdi, deedDocumentBase64 } = req.body;

    // Validate inputs
    if (!isValidPin(pin) || countyId !== "durham_nc" || !isValidAddress(ownerAccountId)) {
      return res.status(400).json({ error: "Invalid input parameters" });
    }

    if (!deedDocumentBase64 || !deedDocumentBase64.startsWith("data:")) {
      return res.status(400).json({ error: "Invalid deed document format" });
    }

    // Get parcel data
    const { data: parcelData, error: parcelError } = await supabase
      .from("parcels")
      .select("*")
      .eq("pin", pin)
      .eq("county_id", countyId)
      .single();

    if (parcelError || !parcelData) {
      return res.status(404).json({ error: "Parcel not found" });
    }

    // Check if claim already exists
    const { data: existingClaim } = await supabase
      .from("token_registry")
      .select("*")
      .eq("pin", pin)
      .eq("county_id", countyId)
      .eq("blockchain_type", "adi")
      .single();

    if (existingClaim) {
      if (existingClaim.verification_status === "pending") {
        return res.status(409).json({
          error: "Claim already submitted",
          message: "This parcel has a pending claim awaiting review",
        });
      } else if (existingClaim.verification_status === "approved") {
        return res.status(409).json({
          error: "Already minted",
          message: "This parcel has already been approved and minted",
        });
      }
    }

    // Build metadata similar to Hedera format
    const props = parcelData.properties || {};
    const metadata = {
      name: `Townhall Parcel #${pin}`,
      description: `Tokenized real estate parcel in ${countyId}`,
      parcel: {
        pin,
        county_id: countyId,
        address: props.address || "",
        location: props.location || "",
      },
      zoning: {
        current: props.current_zoning || "",
        proposed: props.proposed_zoning || "",
        petition_number: parcelData.petition_number || props.petition_number || "",
        petitioner: props.petitioner || "",
        status: props.status || "",
        meeting_date: props.meeting_date || "",
        vote_result: props.vote_result || "",
        legislation_url: props.legislation_url || "",
      },
      geometry: parcelData.geometry,
      shares: {
        total_supply: 1000,
        price_per_share_adi: priceAdi || 0,
      },
      deed: {
        hash: `ipfs://QmDurham${pin.replace(/[^a-zA-Z0-9]/g, '')}`,
        submitted_at: new Date().toISOString(),
      },
    };

    // Insert claim into token_registry with pending status
    const { data: claim, error: insertError } = await supabase
      .from("token_registry")
      .insert({
        pin,
        county_id: countyId,
        blockchain_type: "adi",
        owner_wallet: ownerAccountId,
        price_adi: priceAdi || null,
        deed_document_url: deedDocumentBase64, // MVP: Store inline
        metadata,
        verification_status: "pending",
        listed: false,
        total_shares: 1000,
        available_shares: 1000,
        created_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (insertError) {
      console.error("Insert error:", insertError);
      return res.status(500).json({ error: "Failed to submit claim" });
    }

    res.json({
      success: true,
      message: "Deed claim submitted for county review",
      claimId: claim.id,
      status: "pending",
    });
  } catch (error) {
    console.error("Error submitting claim:", error);
    res.status(500).json({ error: sanitizeError(error) });
  }
});

// ══════════════════════════════════════════════════════════════════
// GET /token/admin/pending-claims
// Get all pending deed claims (admin only)
// ══════════════════════════════════════════════════════════════════
router.get("/admin/pending-claims", async (req, res) => {
  try {
    const { countyId } = req.query;

    if (countyId && countyId !== "durham_nc") {
      return res.status(400).json({ error: "Invalid county ID for Durham service" });
    }

    const { data: claims, error } = await supabase
      .from("token_registry")
      .select("*")
      .eq("county_id", "durham_nc")
      .eq("blockchain_type", "adi")
      .eq("verification_status", "pending")
      .order("created_at", { ascending: false });

    if (error) {
      throw error;
    }

    res.json({
      success: true,
      pending_claims: claims || [],
      count: claims?.length || 0,
    });
  } catch (error) {
    console.error("Error fetching pending claims:", error);
    res.status(500).json({ error: sanitizeError(error) });
  }
});

// ══════════════════════════════════════════════════════════════════
// POST /token/admin/approve-claim
// Approve or reject a deed claim (admin only)
// If approved, mints NFT + creates share tokens on ADI Chain
// ══════════════════════════════════════════════════════════════════
router.post("/admin/approve-claim", async (req, res) => {
  try {
    const { claimId, approved, notes, verifiedBy } = req.body;

    if (!claimId || typeof approved !== "boolean") {
      return res.status(400).json({ error: "Missing required parameters" });
    }

    // Get claim
    const { data: claim, error: claimError } = await supabase
      .from("token_registry")
      .select("*")
      .eq("id", claimId)
      .eq("verification_status", "pending")
      .single();

    if (claimError || !claim) {
      return res.status(404).json({ error: "Claim not found or already processed" });
    }

    if (!approved) {
      // Reject claim
      const { error: updateError } = await supabase
        .from("token_registry")
        .update({
          verification_status: "rejected",
          verification_notes: notes || "Claim rejected",
          verified_by: verifiedBy || "admin@durham.gov",
          verified_at: new Date().toISOString(),
        })
        .eq("id", claimId);

      if (updateError) throw updateError;

      return res.json({
        success: true,
        message: "Claim rejected",
        status: "rejected",
      });
    }

    // Approved - mint on blockchain
    console.log(`\nApproving claim ${claimId} for PIN ${claim.pin}...`);

    const deedHash = `ipfs://QmDurham${claim.pin.replace(/[^a-zA-Z0-9]/g, '')}`;
    const geojson = JSON.stringify(claim.metadata?.geometry || {});

    // Mint NFT + Share tokens
    const mintResult = await mintParcel({
      pin: claim.pin,
      ownerAddress: claim.owner_wallet,
      deedHash,
      geojson,
    });

    // Update database with mint results
    const { error: updateError } = await supabase
      .from("token_registry")
      .update({
        verification_status: "approved",
        verified_by: verifiedBy || "admin@durham.gov",
        verified_at: new Date().toISOString(),
        verification_notes: notes || "Approved and minted",
        nft_token_id: process.env.PARCEL_NFT_ADDRESS, // Contract address
        serial_number: parseInt(mintResult.tokenId), // NFT token ID
        share_token_id: mintResult.shareTokenAddress, // ERC-20 address
        mint_tx_hash: mintResult.transactions.mint,
      })
      .eq("id", claimId);

    if (updateError) {
      console.error("Database update error:", updateError);
      // Blockchain mint succeeded but DB update failed
      return res.status(500).json({
        error: "Minting succeeded but database update failed",
        mintResult,
      });
    }

    res.json({
      success: true,
      message: "Claim approved and minted successfully",
      status: "approved",
      mint: mintResult,
    });
  } catch (error) {
    console.error("Error approving claim:", error);
    res.status(500).json({ error: sanitizeError(error) });
  }
});

// ══════════════════════════════════════════════════════════════════
// GET /token/tokenized
// Get all tokenized parcels
// ══════════════════════════════════════════════════════════════════
router.get("/tokenized", async (req, res) => {
  try {
    const { data: tokenized, error } = await supabase
      .from("token_registry")
      .select("*")
      .eq("county_id", "durham_nc")
      .eq("blockchain_type", "adi")
      .eq("verification_status", "approved")
      .order("verified_at", { ascending: false });

    if (error) throw error;

    res.json({
      success: true,
      tokenized: tokenized || [],
      count: tokenized?.length || 0,
    });
  } catch (error) {
    console.error("Error fetching tokenized parcels:", error);
    res.status(500).json({ error: sanitizeError(error) });
  }
});

export default router;
