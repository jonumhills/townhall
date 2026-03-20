"""
Lender Verification API Routes
Allows lending protocols to verify parcel legitimacy before loan approval
"""
from fastapi import APIRouter, Query, HTTPException
from loguru import logger
from typing import Optional
from supabase import create_client
import os
import requests
from datetime import datetime

ORACLE_URL = os.getenv("ORACLE_URL", "http://localhost:3000")

def query_oracle(search_term: str) -> dict:
    """Call the Hedera oracle service and return verification data, or empty dict on failure."""
    try:
        r = requests.get(f"{ORACLE_URL}/query/{search_term}", timeout=5)
        data = r.json()
        if data.get("success") and data.get("found"):
            return data
    except Exception as e:
        logger.warning(f"Oracle query failed for {search_term}: {e}")
    return {}

router = APIRouter()

# Initialize Supabase client
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_KEY")

if not SUPABASE_URL or not SUPABASE_KEY:
    logger.warning("Supabase credentials not configured")
    supabase = None
else:
    supabase = create_client(SUPABASE_URL, SUPABASE_KEY)


@router.get("/lender/verify/{pin}")
async def verify_parcel_for_lender(
    pin: str,
    county_id: str = Query(..., description="County ID (e.g., durham_nc)")
):
    """
    Verify parcel legitimacy for lending protocols

    Returns comprehensive verification data:
    - Deed NFT verification status
    - Rezoning score
    - Project funding details
    - Parcel information

    This endpoint does NOT query the oracle contract directly - that's done
    client-side in the LenderDashboard component for trustless verification.
    """
    if not supabase:
        raise HTTPException(status_code=500, detail="Database not configured")

    try:
        # 1. Get parcel data with rezoning score
        parcel_response = supabase.table("parcels").select("*").eq("pin", pin).eq("county_id", county_id).execute()

        if not parcel_response.data or len(parcel_response.data) == 0:
            raise HTTPException(status_code=404, detail=f"Parcel {pin} not found in {county_id}")

        parcel = parcel_response.data[0]

        # 1.5. Get petition/zoning data if available
        petition_data = None
        petition_number = parcel.get("petition_number") or parcel.get("properties", {}).get("petition_number")

        if petition_number:
            petition_response = supabase.table("petitions").select("*").eq("petition_number", petition_number).eq("county_id", county_id).execute()

            if petition_response.data and len(petition_response.data) > 0:
                petition = petition_response.data[0]
                petition_data = {
                    "petition_number": petition.get("petition_number"),
                    "petition_id": petition.get("petition_id"),
                    "file_number": petition.get("file_number"),
                    "current_zoning": petition.get("current_zoning"),
                    "proposed_zoning": petition.get("proposed_zoning"),
                    "petitioner": petition.get("petitioner"),
                    "status": petition.get("status"),
                    "action": petition.get("action"),
                    "vote_result": petition.get("vote_result"),
                    "legislation_url": petition.get("legislation_url"),
                    "meeting_date": str(petition.get("meeting_date")) if petition.get("meeting_date") else None,
                    "meeting_type": petition.get("meeting_type"),
                    "location": petition.get("location"),
                    "address": petition.get("address")
                }

        # 2. Query Hedera oracle for Merkle proof verification
        oracle_search = petition_number or pin
        oracle_data = query_oracle(oracle_search)
        oracle_verification = oracle_data.get("verification", {})

        deed_verified = oracle_verification.get("isValid", False)

        # 2b. Get tokenization status from token_registry (for NFT/share token IDs)
        token_response = supabase.table("token_registry").select("*").eq("pin", pin).eq("county_id", county_id).execute()

        nft_token_id = None
        share_token_id = None
        project_funding = None

        if token_response.data and len(token_response.data) > 0:
            token_data = token_response.data[0]
            nft_token_id = token_data.get("nft_token_id")
            share_token_id = token_data.get("share_token_id")

            if token_data.get("project_description"):
                project_funding = {
                    "owner_wallet": token_data.get("owner_wallet"),
                    "project_type": token_data.get("project_type"),
                    "project_description": token_data.get("project_description"),
                    "funding_goal_usd": token_data.get("funding_goal_usd"),
                    "funding_raised_usd": token_data.get("funding_raised_usd", 0),
                    "funding_progress_percent": token_data.get("funding_progress_percent", 0),
                    "expected_completion_date": token_data.get("expected_completion_date"),
                    "expected_rental_yield_percent": token_data.get("expected_rental_yield_percent"),
                    "project_documents": token_data.get("project_documents", {})
                }

        # 3. Build verification response
        verification_data = {
            "pin": pin,
            "county_id": county_id,
            "county_name": parcel.get("county_name"),
            "address": parcel.get("properties", {}).get("SITE_ADDRESS") or parcel.get("properties", {}).get("address"),

            # Deed verification
            "deed_verified": deed_verified,
            "nft_token_id": nft_token_id,
            "share_token_id": share_token_id,

            # Rezoning score
            "rezoning_score": parcel.get("rezoning_score"),
            "rezoning_score_factors": parcel.get("rezoning_score_factors", {}),
            "rezoning_score_updated_at": parcel.get("rezoning_score_updated_at"),

            # Project funding (if available)
            "project_funding": project_funding,

            # Petition/Zoning data (if available)
            "petition_data": petition_data,

            # Additional parcel details
            "parcel_geometry": parcel.get("geometry"),
            "parcel_properties": parcel.get("properties", {}),

            # Oracle / blockchain verification (from localhost:3000)
            "oracle": oracle_verification if oracle_verification else None,

            # Metadata
            "verified_at": datetime.utcnow().isoformat()
        }

        logger.info(f"Lender verification for parcel {pin}: deed_verified={deed_verified} (oracle={'hit' if oracle_verification else 'miss'}), score={parcel.get('rezoning_score')}")

        return verification_data

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error verifying parcel {pin} for lender: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Verification failed: {str(e)}")


@router.post("/lender/log-verification")
async def log_lender_verification(
    lender_wallet: str,
    pin: str,
    county_id: str,
    verification_type: str,
    verification_result: dict,
    risk_level: Optional[str] = None
):
    """
    Log a lender verification request for analytics

    This creates an audit trail of which lenders are checking which parcels
    """
    if not supabase:
        raise HTTPException(status_code=500, detail="Database not configured")

    try:
        verification_log = {
            "lender_wallet": lender_wallet,
            "pin": pin,
            "county_id": county_id,
            "verification_type": verification_type,
            "verification_result": verification_result,
            "risk_level": risk_level,
            "verified_at": datetime.utcnow().isoformat()
        }

        result = supabase.table("lender_verifications").insert(verification_log).execute()

        logger.info(f"Logged lender verification: {lender_wallet} checked {pin}")

        return {
            "success": True,
            "verification_id": result.data[0]["id"] if result.data else None
        }

    except Exception as e:
        logger.error(f"Error logging lender verification: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to log verification: {str(e)}")
