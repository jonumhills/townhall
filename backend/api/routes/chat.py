"""
AI Chat API Route — powered by Claude with tool_use over Supabase petitions data.
Gated by x402: each request requires a valid 1-HBAR Hedera payment (EVM tx hash).
"""
import os
import json
from datetime import datetime, timezone, timedelta
from fastapi import APIRouter, HTTPException, Header, Request
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from typing import Optional
from loguru import logger
from supabase import create_client
import requests as http_requests
import anthropic

router = APIRouter()

# ── Supabase ──────────────────────────────────────────────────────────────────
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_KEY")

if not SUPABASE_URL or not SUPABASE_KEY:
    logger.warning("Supabase credentials not configured")
    supabase = None
else:
    supabase = create_client(SUPABASE_URL, SUPABASE_KEY)

# ── Anthropic ─────────────────────────────────────────────────────────────────
ANTHROPIC_API_KEY = os.getenv("ANTHROPIC_API_KEY")
claude = anthropic.Anthropic(api_key=ANTHROPIC_API_KEY) if ANTHROPIC_API_KEY else None

# ── x402 Payment Gate ─────────────────────────────────────────────────────────
# Townhall operator Hedera account — receives the 1 HBAR per chat message.
TOWNHALL_ACCOUNT_ID  = os.getenv("HEDERA_ACCOUNT_ID", "0.0.5530044")
# Real EVM alias from Mirror Node — use this, not the long-zero derived address.
# curl https://testnet.mirrornode.hedera.com/api/v1/accounts/0.0.5530044 | jq .evm_address
TOWNHALL_EVM_ADDRESS = os.getenv(
    "TOWNHALL_EVM_ADDRESS",
    "0x4ebfd29cd191cf260fca8a1908e686b0837a15ba",
).lower()
logger.info(f"Townhall EVM address: {TOWNHALL_EVM_ADDRESS}")
MIRROR_NODE_BASE     = "https://testnet.mirrornode.hedera.com"
MIN_PAYMENT_TINYBARS = 100_000_000   # 1 HBAR
PAYMENT_WINDOW_SECS  = 300           # 5-minute validity window

PAYMENT_REQUIRED_BODY = {
    "version": "x402-1",
    "scheme": "exact",
    "network": "hedera-testnet",
    "maxAmountRequired": str(MIN_PAYMENT_TINYBARS),
    "resource": "/api/chat",
    "description": "1 HBAR per AI message — Townhall Intelligence",
    "payTo": TOWNHALL_ACCOUNT_ID,
    "payToEvm": TOWNHALL_EVM_ADDRESS,
    "requiredDeadlineSeconds": PAYMENT_WINDOW_SECS,
}


def _verify_hbar_payment(tx_hash: str) -> tuple[bool, str]:
    """
    Verify an EVM tx hash on Hedera Testnet Mirror Node.
    Returns (is_valid, error_msg).
    tx_hash is the 0x... hash returned by MetaMask after sendTransaction.
    """
    try:
        url = f"{MIRROR_NODE_BASE}/api/v1/contracts/results/{tx_hash}"
        r = http_requests.get(url, timeout=10)

        if r.status_code == 404:
            return False, f"Transaction {tx_hash} not found on Hedera Testnet"
        if not r.ok:
            return False, f"Mirror Node returned {r.status_code}"

        data = r.json()

        # Must succeed
        if data.get("result") != "SUCCESS":
            return False, f"Transaction failed on-chain: {data.get('result')}"

        # Must be recent (within payment window)
        ts_str = data.get("timestamp", "0")
        tx_time = float(ts_str.split(".")[0])
        age = datetime.now(timezone.utc).timestamp() - tx_time
        if age > PAYMENT_WINDOW_SECS:
            return False, f"Transaction is {int(age)}s old — must be within {PAYMENT_WINDOW_SECS}s"

        # Must be sent to our EVM address
        to_addr = (data.get("to") or "").lower()
        if to_addr != TOWNHALL_EVM_ADDRESS:
            return False, f"Payment sent to wrong address: {to_addr}"

        # Must be >= 1 HBAR (amount in tinybars on Mirror Node)
        amount = int(data.get("amount") or 0)
        if amount < MIN_PAYMENT_TINYBARS:
            return False, f"Insufficient payment: {amount} tinybars (need {MIN_PAYMENT_TINYBARS})"

        return True, ""

    except Exception as e:
        return False, f"Payment verification error: {e}"


def _is_tx_used(tx_hash: str) -> bool:
    if not supabase:
        return False
    try:
        r = supabase.table("used_payment_txns").select("tx_id").eq("tx_id", tx_hash).execute()
        return len(r.data) > 0
    except Exception:
        return False


def _record_tx(tx_hash: str):
    if not supabase:
        return
    try:
        supabase.table("used_payment_txns").insert({
            "tx_id": tx_hash,
            "used_at": datetime.utcnow().isoformat(),
        }).execute()
    except Exception as e:
        logger.warning(f"Failed to record payment tx (non-fatal): {e}")


# ── Hedera HCS (optional audit log) ──────────────────────────────────────────
HCS_TOPIC_ID = os.getenv("HCS_TOPIC_ID")          # e.g. "0.0.12345"
HEDERA_OPERATOR_ID = os.getenv("HEDERA_OPERATOR_ID")
HEDERA_OPERATOR_KEY = os.getenv("HEDERA_OPERATOR_KEY")


def _hcs_log(user_query: str, tools_used: list[str], answer_snippet: str):
    """Non-blocking HCS audit log — silently skips if env vars not set."""
    if not HCS_TOPIC_ID or not HEDERA_OPERATOR_ID or not HEDERA_OPERATOR_KEY:
        return
    try:
        from hedera import Client, AccountId, PrivateKey, TopicMessageSubmitTransaction, TopicId
        client = Client.forTestnet()
        client.setOperator(
            AccountId.fromString(HEDERA_OPERATOR_ID),
            PrivateKey.fromString(HEDERA_OPERATOR_KEY),
        )
        payload = json.dumps({
            "agent": "townhall-ai",
            "query": user_query[:200],
            "tools_used": tools_used,
            "answer_snippet": answer_snippet[:200],
        })
        TopicMessageSubmitTransaction() \
            .setTopicId(TopicId.fromString(HCS_TOPIC_ID)) \
            .setMessage(payload) \
            .execute(client)
        logger.info(f"HCS audit log submitted to topic {HCS_TOPIC_ID}")
    except Exception as e:
        logger.warning(f"HCS audit log failed (non-fatal): {e}")


# ── Tool implementations ───────────────────────────────────────────────────────

def _search_petitions(county_id: str, query: str, limit: int = 10) -> dict:
    if not supabase:
        return {"error": "Database not configured", "petitions": []}
    try:
        result = (
            supabase.table("petitions")
            .select("petition_number,petitioner,address,location,current_zoning,proposed_zoning,status,action,vote_result,meeting_date,meeting_type")
            .eq("county_id", county_id)
            .or_(
                f"petition_number.ilike.%{query}%,"
                f"petitioner.ilike.%{query}%,"
                f"address.ilike.%{query}%,"
                f"location.ilike.%{query}%,"
                f"proposed_zoning.ilike.%{query}%,"
                f"current_zoning.ilike.%{query}%"
            )
            .limit(limit)
            .execute()
        )
        return {"petitions": result.data, "count": len(result.data)}
    except Exception as e:
        return {"error": str(e), "petitions": []}


def _get_petition_detail(county_id: str, petition_number: str) -> dict:
    if not supabase:
        return {"error": "Database not configured"}
    try:
        result = (
            supabase.table("petitions")
            .select("*")
            .eq("county_id", county_id)
            .eq("petition_number", petition_number)
            .execute()
        )
        if not result.data:
            return {"error": f"Petition {petition_number} not found"}
        return result.data[0]
    except Exception as e:
        return {"error": str(e)}


def _get_petition_stats(county_id: str) -> dict:
    if not supabase:
        return {"error": "Database not configured"}
    try:
        total_res = supabase.table("petitions").select("id", count="exact").eq("county_id", county_id).execute()
        approved_res = supabase.table("petitions").select("id", count="exact").eq("county_id", county_id).ilike("vote_result", "%approved%").execute()
        denied_res = supabase.table("petitions").select("id", count="exact").eq("county_id", county_id).ilike("vote_result", "%denied%").execute()
        pending_res = supabase.table("petitions").select("id", count="exact").eq("county_id", county_id).ilike("status", "%pending%").execute()

        total = total_res.count or 0
        approved = approved_res.count or 0
        denied = denied_res.count or 0
        pending = pending_res.count or 0

        return {
            "county_id": county_id,
            "total_petitions": total,
            "approved": approved,
            "denied": denied,
            "pending": pending,
            "approval_rate_pct": round(approved / total * 100, 1) if total else 0,
        }
    except Exception as e:
        return {"error": str(e)}


def _get_parcels_for_petitions(county_id: str, petition_numbers: list[str]) -> dict:
    """Fetch parcel geometries for given petition numbers — returned as GeoJSON features."""
    if not supabase:
        return {"error": "Database not configured", "features": []}
    try:
        result = (
            supabase.table("parcels")
            .select("pin,county_id,geometry,properties,petition_number,rezoning_score")
            .eq("county_id", county_id)
            .in_("petition_number", petition_numbers)
            .execute()
        )
        features = []
        for row in result.data:
            geom = row.get("geometry")
            if not geom:
                continue
            features.append({
                "type": "Feature",
                "geometry": geom,
                "properties": {
                    "pin": row.get("pin"),
                    "county_id": row.get("county_id"),
                    "petition_number": row.get("petition_number"),
                    "rezoning_score": row.get("rezoning_score"),
                    **(row.get("properties") or {}),
                },
            })
        return {"features": features, "count": len(features)}
    except Exception as e:
        return {"error": str(e), "features": []}


def _filter_petitions(
    county_id: str,
    status: Optional[str] = None,
    proposed_zoning: Optional[str] = None,
    petitioner: Optional[str] = None,
    limit: int = 20,
) -> dict:
    if not supabase:
        return {"error": "Database not configured", "petitions": []}
    try:
        q = (
            supabase.table("petitions")
            .select("petition_number,petitioner,address,location,current_zoning,proposed_zoning,status,action,vote_result,meeting_date")
            .eq("county_id", county_id)
        )
        if status:
            q = q.ilike("status", f"%{status}%")
        if proposed_zoning:
            q = q.ilike("proposed_zoning", f"%{proposed_zoning}%")
        if petitioner:
            q = q.ilike("petitioner", f"%{petitioner}%")

        result = q.limit(limit).execute()
        return {"petitions": result.data, "count": len(result.data)}
    except Exception as e:
        return {"error": str(e), "petitions": []}


# ── Tool definitions for Claude ───────────────────────────────────────────────

TOOLS = [
    {
        "name": "search_petitions",
        "description": "Full-text search across petitions by petition number, petitioner name, address, location, or zoning type. Use this to find specific petitions or developers.",
        "input_schema": {
            "type": "object",
            "properties": {
                "county_id": {"type": "string", "description": "County ID, e.g. 'raleigh_nc'"},
                "query": {"type": "string", "description": "Search term"},
                "limit": {"type": "integer", "description": "Max results (default 10)", "default": 10},
            },
            "required": ["county_id", "query"],
        },
    },
    {
        "name": "get_petition_detail",
        "description": "Get full details of a single petition by its petition number.",
        "input_schema": {
            "type": "object",
            "properties": {
                "county_id": {"type": "string", "description": "County ID, e.g. 'raleigh_nc'"},
                "petition_number": {"type": "string", "description": "Petition number, e.g. 'Z-29-2023'"},
            },
            "required": ["county_id", "petition_number"],
        },
    },
    {
        "name": "get_petition_stats",
        "description": "Get aggregate statistics for a county: total petitions, approval rate, pending count, etc.",
        "input_schema": {
            "type": "object",
            "properties": {
                "county_id": {"type": "string", "description": "County ID, e.g. 'raleigh_nc'"},
            },
            "required": ["county_id"],
        },
    },
    {
        "name": "get_parcels_for_petitions",
        "description": "Fetch parcel polygon geometries for a list of petition numbers. Use this after finding petitions so the user can see them highlighted green on the map.",
        "input_schema": {
            "type": "object",
            "properties": {
                "county_id": {"type": "string", "description": "County ID, e.g. 'raleigh_nc'"},
                "petition_numbers": {
                    "type": "array",
                    "items": {"type": "string"},
                    "description": "List of petition numbers to fetch parcels for",
                },
            },
            "required": ["county_id", "petition_numbers"],
        },
    },
    {
        "name": "filter_petitions",
        "description": "Filter petitions by status, proposed zoning type, or petitioner name.",
        "input_schema": {
            "type": "object",
            "properties": {
                "county_id": {"type": "string", "description": "County ID, e.g. 'raleigh_nc'"},
                "status": {"type": "string", "description": "Filter by status (e.g. 'pending', 'approved')"},
                "proposed_zoning": {"type": "string", "description": "Filter by proposed zoning code (e.g. 'NX-3', 'OX')"},
                "petitioner": {"type": "string", "description": "Filter by petitioner name"},
                "limit": {"type": "integer", "description": "Max results (default 20)", "default": 20},
            },
            "required": ["county_id"],
        },
    },
]

SYSTEM_PROMPT = """You are Townhall Intelligence, an AI assistant specialized in analyzing municipal rezoning petitions and zoning data. You help users—developers, citizens, lenders, and city planners—understand rezoning trends, find specific petitions, and make data-driven decisions.

Default county_id is 'raleigh_nc' unless the user specifies otherwise.

When answering:
- Use the available tools to fetch real data before answering
- ALWAYS call get_parcels_for_petitions after finding petitions — this shows their polygons in green on the map
- Do NOT call get_petition_detail in a loop — use search_petitions or filter_petitions to get the list, then call get_parcels_for_petitions once with all petition numbers
- Present petition numbers clearly (e.g. Z-29-2023)
- Summarize trends when multiple results are returned; do not enumerate every petition individually
- Be concise and direct
- If a petition has blockchain verification on Hedera, mention it"""


# ── Request/Response models ───────────────────────────────────────────────────

class ChatRequest(BaseModel):
    message: str
    county_id: str = "raleigh_nc"
    conversation_history: list = []
    # Internal flag for HCS-10 A2A calls — bypasses x402 payment gate.
    # Only honoured when request originates from localhost (same host).
    _internal_agent_call: bool = False


class ChatResponse(BaseModel):
    reply: str
    tools_used: list[str] = []
    petition_ids: list[str] = []
    parcel_features: list = []   # GeoJSON Feature objects to render green on the map


# ── Endpoint ──────────────────────────────────────────────────────────────────

@router.post("/chat", response_model=ChatResponse)
async def chat(
    req: ChatRequest,
    request: Request,
    x_payment: Optional[str] = Header(default=None, alias="X-Payment"),
):
    if not claude:
        raise HTTPException(status_code=503, detail="AI service not configured. Set ANTHROPIC_API_KEY.")

    # ── x402 payment gate ─────────────────────────────────────────────────────
    # Internal HCS-10 A2A calls from localhost bypass payment — they come from
    # the raleigh Node service on the same host, not from end users.
    is_internal = (
        req._internal_agent_call and
        request.client.host in ("127.0.0.1", "::1", "localhost")
    )
    if not x_payment and not is_internal:
        return JSONResponse(
            status_code=402,
            content={"detail": "Payment required", "payment_required": PAYMENT_REQUIRED_BODY},
            headers={"X-Payment-Required": json.dumps(PAYMENT_REQUIRED_BODY)},
        )

    try:
        payment_data = json.loads(x_payment)
        tx_hash = payment_data.get("txHash") or payment_data.get("tx_hash") or payment_data.get("txId")
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid X-Payment header — must be JSON with txHash field")

    if not tx_hash:
        raise HTTPException(status_code=400, detail="X-Payment header missing txHash field")

    if _is_tx_used(tx_hash):
        return JSONResponse(
            status_code=402,
            content={"detail": "This transaction has already been used. Please send a new payment.", "payment_required": PAYMENT_REQUIRED_BODY},
            headers={"X-Payment-Required": json.dumps(PAYMENT_REQUIRED_BODY)},
        )

    is_valid, err = _verify_hbar_payment(tx_hash)
    if not is_valid:
        return JSONResponse(
            status_code=402,
            content={"detail": f"Payment verification failed: {err}", "payment_required": PAYMENT_REQUIRED_BODY},
            headers={"X-Payment-Required": json.dumps(PAYMENT_REQUIRED_BODY)},
        )

    _record_tx(tx_hash)
    logger.info(f"x402 payment verified: {tx_hash}")
    # ── end payment gate ──────────────────────────────────────────────────────

    # Build messages with conversation history
    messages = []
    for h in req.conversation_history[-10:]:   # last 10 turns max
        if h.get("role") in ("user", "assistant") and h.get("content"):
            messages.append({"role": h["role"], "content": h["content"]})

    # Inject county context into the user message
    user_content = f"[County: {req.county_id}] {req.message}"
    messages.append({"role": "user", "content": user_content})

    tools_used: list[str] = []
    parcel_features: list = []

    # Agentic loop (cap at 12 iterations to prevent runaway)
    for _iteration in range(12):
        response = claude.messages.create(
            model="claude-opus-4-6",
            max_tokens=4096,
            system=SYSTEM_PROMPT,
            tools=TOOLS,
            messages=messages,
        )

        if response.stop_reason == "end_turn":
            # Extract final text
            reply = ""
            for block in response.content:
                if block.type == "text":
                    reply += block.text
            break

        if response.stop_reason == "tool_use":
            # Append assistant turn
            messages.append({"role": "assistant", "content": response.content})

            # Execute each tool
            tool_results = []
            for block in response.content:
                if block.type != "tool_use":
                    continue

                tool_name = block.name
                tool_input = block.input
                tools_used.append(tool_name)

                logger.info(f"Tool call: {tool_name}({tool_input})")

                if tool_name == "search_petitions":
                    result = _search_petitions(
                        tool_input.get("county_id", req.county_id),
                        tool_input["query"],
                        tool_input.get("limit", 10),
                    )
                elif tool_name == "get_petition_detail":
                    result = _get_petition_detail(
                        tool_input.get("county_id", req.county_id),
                        tool_input["petition_number"],
                    )
                elif tool_name == "get_petition_stats":
                    result = _get_petition_stats(tool_input.get("county_id", req.county_id))
                elif tool_name == "get_parcels_for_petitions":
                    result = _get_parcels_for_petitions(
                        tool_input.get("county_id", req.county_id),
                        tool_input.get("petition_numbers", []),
                    )
                    # Accumulate features for the map response
                    parcel_features.extend(result.get("features", []))
                elif tool_name == "filter_petitions":
                    result = _filter_petitions(
                        tool_input.get("county_id", req.county_id),
                        status=tool_input.get("status"),
                        proposed_zoning=tool_input.get("proposed_zoning"),
                        petitioner=tool_input.get("petitioner"),
                        limit=tool_input.get("limit", 20),
                    )
                else:
                    result = {"error": f"Unknown tool: {tool_name}"}

                tool_results.append({
                    "type": "tool_result",
                    "tool_use_id": block.id,
                    "content": json.dumps(result),
                })

            messages.append({"role": "user", "content": tool_results})
            continue

        # max_tokens hit or unexpected stop — extract whatever text exists
        reply = ""
        for block in response.content:
            if hasattr(block, "text"):
                reply += block.text
        if not reply:
            reply = "I reached my response limit. Please try a more specific question."
        break
    else:
        # Exhausted 12 iterations without a final end_turn
        reply = "I needed too many steps to answer that. Please try a more specific question."

    # Extract petition IDs mentioned in the reply
    import re
    petition_ids = list({m.group(0) for m in re.finditer(r'[A-Z]-\d{1,4}-\d{4}', reply)})

    # HCS audit log (non-blocking)
    _hcs_log(req.message, list(set(tools_used)), reply)

    logger.info(f"Chat: query='{req.message[:80]}' tools={tools_used} petitions_mentioned={petition_ids}")

    # Deduplicate parcel features by pin
    seen_pins = set()
    unique_parcel_features = []
    for f in parcel_features:
        pin = f.get("properties", {}).get("pin")
        if pin and pin not in seen_pins:
            seen_pins.add(pin)
            unique_parcel_features.append(f)

    return ChatResponse(
        reply=reply,
        tools_used=list(set(tools_used)),
        petition_ids=petition_ids,
        parcel_features=unique_parcel_features,
    )
