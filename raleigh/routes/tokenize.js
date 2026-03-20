import { Router } from "express";
import crypto from "crypto";
import { getSupabase } from "../supabase.js";
import { createCountyNFTToken, loadDeployed } from "../create-parcel-token.js";
import { mintParcel } from "../mint-parcel-nft.js";
import { storeDeedDocument } from "../utils/file-upload.js";

const router = Router();

// ─────────────────────────────────────────────────────────────────────────────
// POST /token/create
// Creates the NFT token type for a county — run ONCE per county.
// Body: { countyId }
// ─────────────────────────────────────────────────────────────────────────────
router.post("/create", async (req, res) => {
  try {
    const { countyId } = req.body;
    if (!countyId) {
      return res.status(400).json({ error: "countyId is required" });
    }

    const deployed = loadDeployed();
    if (deployed[countyId]?.nftTokenId) {
      return res.json({
        message: "Token already exists for this county",
        nftTokenId: deployed[countyId].nftTokenId,
        explorerUrl: `https://hashscan.io/testnet/token/${deployed[countyId].nftTokenId}`,
      });
    }

    const result = await createCountyNFTToken(countyId);
    res.json(result);
  } catch (err) {
    console.error("Error creating county token:", err);
    res.status(500).json({ error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /token/verify-deed
// Verifies a parcel claim by matching the submitted PIN against Supabase.
// In MVP: PIN is submitted directly (no PDF parsing in Node.js).
// PDF parsing stays in Python backend if needed — here we just validate.
//
// Body: { pin, countyId, ownerAccountId }
// ─────────────────────────────────────────────────────────────────────────────
router.post("/verify-deed", async (req, res) => {
  try {
    const { pin, countyId, ownerAccountId } = req.body;

    if (!pin || !countyId || !ownerAccountId) {
      return res
        .status(400)
        .json({ error: "pin, countyId, and ownerAccountId are required" });
    }

    const sb = getSupabase();

    // Check parcel exists in Supabase
    const parcelRes = await sb
      .from("parcels")
      .select("parcel_id, pin, petition_id, petition_number, geometry, properties")
      .eq("pin", pin)
      .eq("county_id", countyId)
      .single();

    if (parcelRes.error || !parcelRes.data) {
      return res.status(404).json({
        error: `Parcel PIN ${pin} not found in ${countyId}`,
        pin_matched: false,
      });
    }

    // Check not already tokenized
    const tokenRes = await sb
      .from("token_registry")
      .select("id")
      .eq("pin", pin)
      .eq("county_id", countyId)
      .maybeSingle();

    if (tokenRes.data) {
      return res.status(409).json({
        error: "This parcel is already tokenized",
        pin_matched: true,
        already_tokenized: true,
      });
    }

    // Fetch petition details for this parcel
    const petitionRes = await sb
      .from("petitions")
      .select(
        "petition_number, location, address, current_zoning, proposed_zoning, petitioner, status, meeting_date, vote_result"
      )
      .eq("petition_id", parcelRes.data.petition_id)
      .maybeSingle();

    res.json({
      pin_matched: true,
      already_tokenized: false,
      parcel: {
        pin: parcelRes.data.pin,
        parcel_id: parcelRes.data.parcel_id,
        county_id: countyId,
        geometry: parcelRes.data.geometry,
      },
      petition: petitionRes.data || {},
    });
  } catch (err) {
    console.error("Error verifying deed:", err);
    res.status(500).json({ error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /token/submit-claim
// NEW: Option A1 workflow — submit claim with deed document for manual review.
// Creates pending claim in token_registry (no mint yet).
//
// Body: { pin, countyId, ownerAccountId, priceHbar, deedDocumentBase64 }
// ─────────────────────────────────────────────────────────────────────────────
router.post("/submit-claim", async (req, res) => {
  try {
    const { pin, countyId, ownerAccountId, priceHbar, deedDocumentBase64 } = req.body;

    if (!pin || !countyId || !ownerAccountId || !deedDocumentBase64) {
      return res.status(400).json({
        error: "pin, countyId, ownerAccountId, and deedDocumentBase64 are required",
      });
    }

    const sb = getSupabase();

    // 1. Verify parcel exists
    const parcelRes = await sb
      .from("parcels")
      .select("parcel_id, pin, petition_id, geometry, properties")
      .eq("pin", pin)
      .eq("county_id", countyId)
      .single();

    if (parcelRes.error || !parcelRes.data) {
      return res.status(404).json({ error: `Parcel ${pin} not found` });
    }

    // 2. Check not already claimed
    const existingClaim = await sb
      .from("token_registry")
      .select("id, verification_status")
      .eq("pin", pin)
      .eq("county_id", countyId)
      .maybeSingle();

    if (existingClaim.data) {
      const status = existingClaim.data.verification_status;
      return res.status(409).json({
        error: `Parcel already has a ${status} claim`,
        verification_status: status,
      });
    }

    // 3. Store deed document
    const { url: deedDocumentUrl, sizeKB } = await storeDeedDocument(
      deedDocumentBase64,
      pin
    );

    // 4. Fetch petition metadata for the claim record
    const petitionRes = await sb
      .from("petitions")
      .select(
        "petition_number, file_number, location, address, current_zoning, proposed_zoning, petitioner, status, action, vote_result, meeting_date, legislation_url"
      )
      .eq("petition_id", parcelRes.data.petition_id)
      .maybeSingle();

    const petition = petitionRes.data || {};

    // Build metadata (same as before, but claim not minted yet)
    const metadata = {
      name: `Townhall Parcel #${pin}`,
      description: `Tokenized real estate parcel in ${countyId}`,
      parcel: {
        pin,
        county_id: countyId,
        address: petition.address || "",
        location: petition.location || "",
      },
      zoning: {
        current: petition.current_zoning || "",
        proposed: petition.proposed_zoning || "",
        petition_number: petition.petition_number || "",
        petitioner: petition.petitioner || "",
        status: petition.status || "",
        meeting_date: petition.meeting_date || "",
        vote_result: petition.vote_result || "",
        legislation_url: petition.legislation_url || "",
      },
      geometry: parcelRes.data.geometry,
      shares: {
        total_supply: 1000,
        price_per_share_hbar: priceHbar || 0,
      },
      deed: {
        hash: crypto
          .createHash("sha256")
          .update(`${pin}-${countyId}-${ownerAccountId}`)
          .digest("hex"),
        submitted_at: new Date().toISOString(),
      },
    };

    const ipfsCid = crypto
      .createHash("sha256")
      .update(JSON.stringify(metadata))
      .digest("hex");

    // 5. Insert pending claim into token_registry
    const { data: claim, error: insertError } = await sb
      .from("token_registry")
      .insert({
        pin,
        county_id: countyId,
        owner_wallet: ownerAccountId,
        deed_document_url: deedDocumentUrl,
        verification_status: "pending",
        ipfs_cid: ipfsCid,
        metadata,
        price_hbar: priceHbar || null,
        created_at: new Date().toISOString(),
        // NFT fields are NULL until county approves and mints
        nft_token_id: null,
        serial_number: null,
        share_token_id: null,
        total_shares: null,
        available_shares: null,
        listed: false,
      })
      .select()
      .single();

    if (insertError) {
      console.error("Supabase insert error:", insertError);
      return res.status(500).json({ error: insertError.message });
    }

    console.log(
      `Claim submitted for PIN ${pin} by ${ownerAccountId} — pending county review (${sizeKB}KB deed)`
    );

    res.json({
      success: true,
      claim_id: claim.id,
      pin,
      county_id: countyId,
      verification_status: "pending",
      message:
        "Claim submitted successfully. Awaiting county legislator approval.",
      deed_size_kb: sizeKB,
    });
  } catch (err) {
    console.error("Error submitting claim:", err);
    res.status(500).json({ error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /token/mint
// OLD FLOW (kept for backwards compatibility / direct minting if needed)
// Mints NFT deed + 1000 fungible shares for a verified parcel.
// Stores result in Supabase token_registry table.
//
// Body: { pin, countyId, ownerAccountId, priceHbar }
// ─────────────────────────────────────────────────────────────────────────────
router.post("/mint", async (req, res) => {
  try {
    const { pin, countyId, ownerAccountId, priceHbar } = req.body;

    if (!pin || !countyId || !ownerAccountId) {
      return res
        .status(400)
        .json({ error: "pin, countyId, and ownerAccountId are required" });
    }

    const sb = getSupabase();

    // Fetch parcel + petition to build IPFS metadata
    const parcelRes = await sb
      .from("parcels")
      .select("parcel_id, pin, petition_id, geometry, properties")
      .eq("pin", pin)
      .eq("county_id", countyId)
      .single();

    if (parcelRes.error || !parcelRes.data) {
      return res.status(404).json({ error: `Parcel ${pin} not found` });
    }

    const petitionRes = await sb
      .from("petitions")
      .select(
        "petition_number, file_number, location, address, current_zoning, proposed_zoning, petitioner, status, action, vote_result, meeting_date, legislation_url"
      )
      .eq("petition_id", parcelRes.data.petition_id)
      .maybeSingle();

    const petition = petitionRes.data || {};

    // Build metadata — stored inline for MVP (no IPFS dependency)
    // In production: upload to IPFS and use the CID
    const metadata = {
      name: `Townhall Parcel #${pin}`,
      description: `Tokenized real estate parcel in ${countyId}`,
      parcel: {
        pin,
        county_id: countyId,
        address: petition.address || "",
        location: petition.location || "",
      },
      zoning: {
        current: petition.current_zoning || "",
        proposed: petition.proposed_zoning || "",
        petition_number: petition.petition_number || "",
        petitioner: petition.petitioner || "",
        status: petition.status || "",
        meeting_date: petition.meeting_date || "",
        vote_result: petition.vote_result || "",
        legislation_url: petition.legislation_url || "",
      },
      geometry: parcelRes.data.geometry,
      shares: {
        total_supply: 1000,
        price_per_share_hbar: priceHbar || 0,
      },
      deed: {
        hash: crypto
          .createHash("sha256")
          .update(`${pin}-${countyId}-${ownerAccountId}`)
          .digest("hex"),
        verified_at: new Date().toISOString(),
      },
    };

    // Use metadata hash as IPFS CID placeholder for MVP
    const ipfsCid = crypto
      .createHash("sha256")
      .update(JSON.stringify(metadata))
      .digest("hex");

    // Mint on Hedera
    const mintResult = await mintParcel({
      countyId,
      pin,
      ipfsCid,
      ownerAccountId,
    });

    // Store in Supabase token_registry
    const { error: insertError } = await sb.from("token_registry").insert({
      pin,
      county_id: countyId,
      nft_token_id: mintResult.nftTokenId,
      serial_number: mintResult.serialNumber,
      share_token_id: mintResult.shareTokenId,
      total_shares: mintResult.totalShares,
      available_shares: mintResult.totalShares,
      owner_wallet: ownerAccountId,
      ipfs_cid: ipfsCid,
      metadata,
      listed: false,
      price_hbar: priceHbar || null,
      mint_tx_hash: mintResult.txHash,
      created_at: new Date().toISOString(),
    });

    if (insertError) {
      console.error("Supabase insert error:", insertError);
      // Mint succeeded but DB failed — return mint result with warning
      return res.status(207).json({
        warning: "Minted on Hedera but failed to store in database",
        db_error: insertError.message,
        ...mintResult,
      });
    }

    res.json({
      success: true,
      ...mintResult,
      metadata,
    });
  } catch (err) {
    console.error("Error minting parcel:", err);
    res.status(500).json({ error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /token/tokenized
// Returns all tokenized parcel PINs (for map layer highlighting).
// ─────────────────────────────────────────────────────────────────────────────
router.get("/tokenized", async (req, res) => {
  try {
    const { countyId } = req.query;
    const sb = getSupabase();

    let query = sb
      .from("token_registry")
      .select("*");

    if (countyId) {
      query = query.eq("county_id", countyId);
    }

    const { data, error } = await query;

    if (error) throw error;

    res.json({ tokenized: data || [] });
  } catch (err) {
    console.error("Error fetching tokenized parcels:", err);
    res.status(500).json({ error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /admin/approve-claim
// County admin endpoint — approves a pending claim and mints NFT with county sig.
//
// Body: { claimId, approved: boolean, notes?: string, verifiedBy: string }
// ─────────────────────────────────────────────────────────────────────────────
router.post("/admin/approve-claim", async (req, res) => {
  try {
    const { claimId, approved, notes, verifiedBy } = req.body;

    if (!claimId || approved === undefined || !verifiedBy) {
      return res.status(400).json({
        error: "claimId, approved (boolean), and verifiedBy are required",
      });
    }

    const sb = getSupabase();

    // 1. Fetch pending claim
    const { data: claim, error: fetchError } = await sb
      .from("token_registry")
      .select("*")
      .eq("id", claimId)
      .single();

    if (fetchError || !claim) {
      return res.status(404).json({ error: "Claim not found" });
    }

    if (claim.verification_status !== "pending") {
      return res.status(400).json({
        error: `Claim already ${claim.verification_status}`,
      });
    }

    // 2. If rejected: update status and return
    if (!approved) {
      const { error: updateError } = await sb
        .from("token_registry")
        .update({
          verification_status: "rejected",
          verification_notes: notes || "Rejected by county admin",
          verified_by: verifiedBy,
          verified_at: new Date().toISOString(),
        })
        .eq("id", claimId);

      if (updateError) {
        return res.status(500).json({ error: updateError.message });
      }

      console.log(`Claim ${claimId} rejected by ${verifiedBy}`);
      return res.json({
        success: true,
        claim_id: claimId,
        verification_status: "rejected",
        message: "Claim rejected",
      });
    }

    // 3. If approved: mint NFT with county signature
    const { pin, county_id, owner_wallet, metadata, ipfs_cid, price_hbar } = claim;

    console.log(
      `County admin ${verifiedBy} approved claim ${claimId} — minting NFT for PIN ${pin}...`
    );

    const mintResult = await mintParcel({
      countyId: county_id,
      pin,
      ipfsCid: ipfs_cid,
      ownerAccountId: owner_wallet,
    });

    // 4. Update claim with mint result
    const { error: updateError } = await sb
      .from("token_registry")
      .update({
        verification_status: "approved",
        verification_notes: notes || "Approved and minted by county admin",
        verified_by: verifiedBy,
        verified_at: new Date().toISOString(),
        nft_token_id: mintResult.nftTokenId,
        serial_number: mintResult.serialNumber,
        share_token_id: mintResult.shareTokenId,
        total_shares: mintResult.totalShares,
        available_shares: mintResult.totalShares,
        mint_tx_hash: mintResult.txHash,
      })
      .eq("id", claimId);

    if (updateError) {
      console.error("Mint succeeded but DB update failed:", updateError);
      return res.status(207).json({
        warning: "Minted on Hedera but failed to update claim status",
        db_error: updateError.message,
        ...mintResult,
      });
    }

    console.log(
      `Claim ${claimId} approved and minted: ${mintResult.nftTokenId}#${mintResult.serialNumber}`
    );

    res.json({
      success: true,
      claim_id: claimId,
      verification_status: "approved",
      message: "Claim approved and NFT minted with county signature",
      mint: {
        nft_token_id: mintResult.nftTokenId,
        serial_number: mintResult.serialNumber,
        share_token_id: mintResult.shareTokenId,
        total_shares: mintResult.totalShares,
        tx_hash: mintResult.txHash,
        explorer_urls: mintResult.explorerUrls,
      },
    });
  } catch (err) {
    console.error("Error approving claim:", err);
    res.status(500).json({ error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /admin/pending-claims
// County admin endpoint — fetch all pending claims for review.
// Query params: ?countyId=raleigh_nc (optional)
// ─────────────────────────────────────────────────────────────────────────────
router.get("/admin/pending-claims", async (req, res) => {
  try {
    const { countyId } = req.query;
    const sb = getSupabase();

    let query = sb
      .from("token_registry")
      .select("*")
      .eq("verification_status", "pending")
      .eq("blockchain_type", "hedera")
      .order("created_at", { ascending: false });

    if (countyId) {
      query = query.eq("county_id", countyId);
    }

    const { data, error } = await query;

    if (error) throw error;

    res.json({
      pending_claims: data || [],
      count: data?.length || 0,
    });
  } catch (err) {
    console.error("Error fetching pending claims:", err);
    res.status(500).json({ error: err.message });
  }
});

export default router;
