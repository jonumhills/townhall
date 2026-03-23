"""
Lender Verification API Routes
Allows lending protocols to verify parcel legitimacy before loan approval
"""
from fastapi import APIRouter, Query, HTTPException, BackgroundTasks, Header
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from loguru import logger
from typing import Optional
from supabase import create_client
import os
import requests
from datetime import datetime, timezone

# ── x402 Payment Gate ─────────────────────────────────────────────────────────
TOWNHALL_ACCOUNT_ID  = os.getenv("HEDERA_ACCOUNT_ID", "0.0.5530044")
TOWNHALL_EVM_ADDRESS = os.getenv(
    "TOWNHALL_EVM_ADDRESS",
    "0x4ebfd29cd191cf260fca8a1908e686b0837a15ba",
).lower()
MIRROR_NODE_BASE     = "https://testnet.mirrornode.hedera.com"
MIN_PAYMENT_TINYBARS = 100_000_000   # 1 HBAR
PAYMENT_WINDOW_SECS  = 300           # 5-minute validity window

PAYMENT_REQUIRED_BODY = {
    "version": "x402-1",
    "scheme": "exact",
    "network": "hedera-testnet",
    "maxAmountRequired": str(MIN_PAYMENT_TINYBARS),
    "resource": "/api/lender/verify",
    "description": "1 HBAR per parcel verification — Townhall Lender Portal",
    "payTo": TOWNHALL_ACCOUNT_ID,
    "payToEvm": TOWNHALL_EVM_ADDRESS,
    "requiredDeadlineSeconds": PAYMENT_WINDOW_SECS,
}


def _verify_hbar_payment(tx_hash: str) -> tuple[bool, str]:
    """Verify an EVM tx hash on Hedera Testnet Mirror Node."""
    try:
        url = f"{MIRROR_NODE_BASE}/api/v1/contracts/results/{tx_hash}"
        r = requests.get(url, timeout=10)
        if r.status_code == 404:
            return False, f"Transaction {tx_hash} not found on Hedera Testnet"
        if not r.ok:
            return False, f"Mirror Node returned {r.status_code}"
        data = r.json()
        if data.get("result") != "SUCCESS":
            return False, f"Transaction failed on-chain: {data.get('result')}"
        ts_str = data.get("timestamp", "0")
        tx_time = float(ts_str.split(".")[0])
        age = datetime.now(timezone.utc).timestamp() - tx_time
        if age > PAYMENT_WINDOW_SECS:
            return False, f"Transaction is {int(age)}s old — must be within {PAYMENT_WINDOW_SECS}s"
        to_addr = (data.get("to") or "").lower()
        if to_addr != TOWNHALL_EVM_ADDRESS:
            return False, f"Payment sent to wrong address: {to_addr}"
        amount = int(data.get("amount") or 0)
        if amount < MIN_PAYMENT_TINYBARS:
            return False, f"Insufficient payment: {amount} tinybars (need {MIN_PAYMENT_TINYBARS})"
        return True, ""
    except Exception as e:
        return False, f"Payment verification error: {e}"


# ── Service URLs ───────────────────────────────────────────────────────────────
HEDERA_SERVICE_URL = os.getenv("HEDERA_SERVICE_URL", "http://localhost:3001")
HCS_TOPIC_ID = os.getenv("HCS_LENDER_AUDIT_TOPIC_ID", "")

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


def _log_verification_bg(pin: str, county_id: str, lender_wallet: str,
                          verification_result: dict, risk_level: Optional[str]):
    """Background task: write to lender_verifications + HCS audit log."""
    if not supabase:
        return
    try:
        row = {
            "lender_wallet": lender_wallet,
            "pin": pin,
            "county_id": county_id,
            "verification_type": "full_verification",
            "verification_result": verification_result,
            "risk_level": risk_level,
            "verified_at": datetime.utcnow().isoformat(),
        }
        result = supabase.table("lender_verifications").insert(row).execute()
        verification_id = result.data[0]["id"] if result.data else None
        logger.info(f"Logged lender verification: {lender_wallet} checked {pin} (id={verification_id})")

        # HCS audit trail
        if HCS_TOPIC_ID and lender_wallet and lender_wallet != "anonymous":
            try:
                hcs_payload = {
                    "event": "lender_verify",
                    "wallet": lender_wallet,
                    "pin": pin,
                    "county_id": county_id,
                    "risk_level": risk_level,
                    "score": verification_result.get("rezoning_score"),
                    "verification_id": verification_id,
                    "timestamp": datetime.utcnow().isoformat(),
                }
                r = requests.post(
                    f"{HEDERA_SERVICE_URL}/audit/log",
                    json={"topic_id": HCS_TOPIC_ID, "message": hcs_payload},
                    timeout=10,
                )
                if r.ok:
                    hcs = r.json()
                    logger.info(f"HCS audit logged: seq={hcs.get('sequence_number')} tx={hcs.get('transaction_id')}")
                    # Persist HCS refs back to the row
                    if verification_id and r.ok:
                        supabase.table("lender_verifications").update({
                            "hcs_topic_id": HCS_TOPIC_ID,
                            "hcs_sequence_number": hcs.get("sequence_number"),
                            "hcs_transaction_id": hcs.get("transaction_id"),
                        }).eq("id", verification_id).execute()
            except Exception as hcs_err:
                logger.warning(f"HCS audit failed (non-fatal): {hcs_err}")
    except Exception as e:
        logger.error(f"Background verification log failed: {e}")

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
    background_tasks: BackgroundTasks,
    county_id: str = Query(..., description="County ID (e.g., durham_nc)"),
    lender_wallet: str = Query(default="anonymous", description="Lender EVM wallet address"),
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

        # Compute score from petition data if DB score is missing
        db_score = parcel.get("rezoning_score")
        base_score = db_score if db_score is not None else _compute_score(
            petition_data or {}, parcel.get("properties", {})
        )
        verification_data["rezoning_score"] = base_score

        # Attach demand signal and adjusted score
        demand = _get_demand_signal(pin, county_id)
        verification_data["demand_signal"] = demand
        verification_data["adjusted_score"] = min(100, base_score + demand["demand_bonus"])

        # Derive risk level for logging
        score = parcel.get('rezoning_score') or 0
        risk_level = "low" if score >= 70 else "medium" if score >= 40 else "high"

        logger.info(f"Lender verification for parcel {pin}: wallet={lender_wallet}, deed_verified={deed_verified}, score={score}")

        # Fire-and-forget: log to Supabase + HCS
        background_tasks.add_task(
            _log_verification_bg,
            pin, county_id, lender_wallet, verification_data, risk_level
        )

        return verification_data

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error verifying parcel {pin} for lender: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Verification failed: {str(e)}")


class VerifyRequest(BaseModel):
    pin: str
    county_id: str
    lender_wallet: str = "anonymous"


@router.post("/lender/verify")
async def verify_parcel_post(
    body: VerifyRequest,
    background_tasks: BackgroundTasks,
    x_payment: Optional[str] = Header(None, alias="X-Payment"),
):
    """
    POST /lender/verify — x402-gated version of parcel verification.
    Requires a valid 1-HBAR Hedera EVM payment sent in X-Payment header.
    """
    # ── Step 1: demand payment if header is missing ────────────────────────────
    if not x_payment:
        return JSONResponse(
            status_code=402,
            content={"payment_required": PAYMENT_REQUIRED_BODY},
        )

    # ── Step 2: parse and verify the payment ──────────────────────────────────
    import json as _json
    try:
        payment_data = _json.loads(x_payment)
        tx_hash = payment_data.get("txHash", "")
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid X-Payment header format")

    if not tx_hash:
        raise HTTPException(status_code=400, detail="Missing txHash in X-Payment header")

    # Check replay
    if supabase:
        try:
            used = supabase.table("used_payment_txns").select("tx_id").eq("tx_id", tx_hash).execute()
            if used.data:
                raise HTTPException(status_code=402, detail="Payment transaction already used")
        except HTTPException:
            raise
        except Exception:
            pass

    ok, err = _verify_hbar_payment(tx_hash)
    if not ok:
        raise HTTPException(status_code=402, detail=f"Payment verification failed: {err}")

    # Record tx to prevent replay
    if supabase:
        try:
            supabase.table("used_payment_txns").insert({
                "tx_id": tx_hash,
                "used_at": datetime.utcnow().isoformat(),
            }).execute()
        except Exception as e:
            logger.warning(f"Failed to record payment tx (non-fatal): {e}")

    logger.info(f"Lender verify payment accepted: tx={tx_hash} pin={body.pin}")

    # ── Step 3: run the same verification logic as the GET endpoint ───────────
    if not supabase:
        raise HTTPException(status_code=500, detail="Database not configured")

    try:
        parcel_response = supabase.table("parcels").select("*").eq("pin", body.pin).eq("county_id", body.county_id).execute()
        if not parcel_response.data:
            raise HTTPException(status_code=404, detail=f"Parcel {body.pin} not found in {body.county_id}")

        parcel = parcel_response.data[0]

        petition_data = None
        petition_number = parcel.get("petition_number") or parcel.get("properties", {}).get("petition_number")
        if petition_number:
            petition_response = supabase.table("petitions").select("*").eq("petition_number", petition_number).eq("county_id", body.county_id).execute()
            if petition_response.data:
                p = petition_response.data[0]
                petition_data = {
                    "petition_number": p.get("petition_number"),
                    "petition_id": p.get("petition_id"),
                    "file_number": p.get("file_number"),
                    "current_zoning": p.get("current_zoning"),
                    "proposed_zoning": p.get("proposed_zoning"),
                    "petitioner": p.get("petitioner"),
                    "status": p.get("status"),
                    "action": p.get("action"),
                    "vote_result": p.get("vote_result"),
                    "legislation_url": p.get("legislation_url"),
                    "meeting_date": str(p.get("meeting_date")) if p.get("meeting_date") else None,
                    "meeting_type": p.get("meeting_type"),
                    "location": p.get("location"),
                    "address": p.get("address"),
                }

        oracle_search = petition_number or body.pin
        oracle_data = query_oracle(oracle_search)
        oracle_verification = oracle_data.get("verification", {})
        deed_verified = oracle_verification.get("isValid", False)

        token_response = supabase.table("token_registry").select("*").eq("pin", body.pin).eq("county_id", body.county_id).execute()
        nft_token_id = share_token_id = project_funding = None
        if token_response.data:
            td = token_response.data[0]
            nft_token_id = td.get("nft_token_id")
            share_token_id = td.get("share_token_id")
            if td.get("project_description"):
                project_funding = {
                    "owner_wallet": td.get("owner_wallet"),
                    "project_type": td.get("project_type"),
                    "project_description": td.get("project_description"),
                    "funding_goal_usd": td.get("funding_goal_usd"),
                    "funding_raised_usd": td.get("funding_raised_usd", 0),
                    "funding_progress_percent": td.get("funding_progress_percent", 0),
                    "expected_completion_date": td.get("expected_completion_date"),
                    "expected_rental_yield_percent": td.get("expected_rental_yield_percent"),
                    "project_documents": td.get("project_documents", {}),
                }

        db_score = parcel.get("rezoning_score")
        base_score = db_score if db_score is not None else _compute_score(
            petition_data or {}, parcel.get("properties", {})
        )
        demand = _get_demand_signal(body.pin, body.county_id)

        verification_data = {
            "pin": body.pin,
            "county_id": body.county_id,
            "county_name": parcel.get("county_name"),
            "address": parcel.get("properties", {}).get("SITE_ADDRESS") or parcel.get("properties", {}).get("address"),
            "deed_verified": deed_verified,
            "nft_token_id": nft_token_id,
            "share_token_id": share_token_id,
            "rezoning_score": base_score,
            "rezoning_score_factors": parcel.get("rezoning_score_factors", {}),
            "rezoning_score_updated_at": parcel.get("rezoning_score_updated_at"),
            "project_funding": project_funding,
            "petition_data": petition_data,
            "parcel_geometry": parcel.get("geometry"),
            "parcel_properties": parcel.get("properties", {}),
            "oracle": oracle_verification if oracle_verification else None,
            "demand_signal": demand,
            "adjusted_score": min(100, base_score + demand["demand_bonus"]),
            "verified_at": datetime.utcnow().isoformat(),
        }

        risk_level = "low" if base_score >= 70 else "medium" if base_score >= 40 else "high"
        background_tasks.add_task(
            _log_verification_bg,
            body.pin, body.county_id, body.lender_wallet, verification_data, risk_level,
        )

        return verification_data

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error verifying parcel {body.pin}: {e}")
        raise HTTPException(status_code=500, detail=f"Verification failed: {str(e)}")


ZONING_RANKS = {
    'AG': -4, 'EX': -4, 'CON': -4, 'OS': -3,
    'R-40': -2, 'R-20': -1, 'R-10': 0, 'R-6': 1, 'R-4': 2,
    'RX': 2, 'NX': 3, 'OX': 3, 'TOD': 4, 'CX': 4, 'DX': 5,
    'IX': -1, 'IH': -2,
}

def _compute_score(petition: dict, parcel_props: dict) -> int:
    """Compute zoning score from petition + parcel data when DB score is null."""
    score = 50

    # Zoning rank
    raw = petition.get('current_zoning') or parcel_props.get('current_zoning') or ''
    code = raw.upper().split('-CU')[0].split(' ')[0]  # strip -CU suffix (conditional use)
    score += ZONING_RANKS.get(code, 0) * 5

    # Document completeness
    if petition.get('legislation_url') or parcel_props.get('legislation_url'):
        score += 10

    # Rezoning stability
    proposed = petition.get('proposed_zoning') or parcel_props.get('proposed_zoning')
    current  = petition.get('current_zoning')  or parcel_props.get('current_zoning')
    if not proposed or proposed == current:
        score += 15
    else:
        score -= 10

    # Vote result — check both vote_result AND action fields
    vote = (petition.get('vote_result') or petition.get('action') or '').lower()
    if any(w in vote for w in ('approved', 'passed')):  score += 10
    if any(w in vote for w in ('denied', 'rejected')):  score -= 15
    if 'withdrawn' in vote:                              score -= 5

    # Status — treat Finalized as approved
    status = (petition.get('status') or '').lower()
    if status in ('approved', 'finalized'):  score += 5
    if status == 'denied':                   score -= 10
    if status == 'pending':                  score -= 5

    return max(0, min(100, score))


def _demand_bonus(unique_verifiers: int) -> int:
    """Tiered demand bonus: unique wallets that verified in last 30 days → score boost."""
    if unique_verifiers >= 10: return 18
    if unique_verifiers >= 5:  return 12
    if unique_verifiers >= 3:  return 8
    if unique_verifiers >= 1:  return 4
    return 0


def _get_demand_signal(pin: str, county_id: str) -> dict:
    """Count distinct non-anonymous lender wallets in the last 30 days."""
    if not supabase:
        return {"unique_verifiers": 0, "demand_bonus": 0}
    try:
        from datetime import timedelta
        cutoff = (datetime.utcnow() - timedelta(days=30)).isoformat()
        rows = (
            supabase.table("lender_verifications")
            .select("lender_wallet")
            .eq("pin", pin)
            .eq("county_id", county_id)
            .neq("lender_wallet", "anonymous")
            .gte("verified_at", cutoff)
            .execute()
        )
        wallets = {r["lender_wallet"] for r in (rows.data or [])}
        n = len(wallets)
        return {"unique_verifiers": n, "demand_bonus": _demand_bonus(n)}
    except Exception as e:
        logger.warning(f"Demand signal fetch failed: {e}")
        return {"unique_verifiers": 0, "demand_bonus": 0}


@router.get("/lender/demand/{pin}")
async def get_parcel_demand(
    pin: str,
    county_id: str = Query(...),
):
    """Return unique lender verifier count + score bonus for a parcel."""
    return _get_demand_signal(pin, county_id)


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
