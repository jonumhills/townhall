"""
Petitions API Routes
"""
from fastapi import APIRouter, HTTPException, Query
from loguru import logger
from typing import Optional
from supabase import create_client
import os

router = APIRouter()

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_KEY")

if not SUPABASE_URL or not SUPABASE_KEY:
    logger.warning("Supabase credentials not configured")
    supabase = None
else:
    supabase = create_client(SUPABASE_URL, SUPABASE_KEY)


@router.get("/counties/{county_id}/petitions")
async def list_petitions(
    county_id: str,
    limit: int = Query(50, ge=1, le=500),
    offset: int = Query(0, ge=0),
    status: Optional[str] = Query(None),
    search: Optional[str] = Query(None),
):
    """List petitions for a county with optional filtering"""
    if not supabase:
        raise HTTPException(status_code=500, detail="Database not configured")

    try:
        query = supabase.table("petitions").select("*").eq("county_id", county_id)

        if status:
            query = query.eq("status", status)

        if search:
            query = query.or_(
                f"petition_number.ilike.%{search}%,"
                f"petitioner.ilike.%{search}%,"
                f"address.ilike.%{search}%,"
                f"location.ilike.%{search}%"
            )

        result = query.range(offset, offset + limit - 1).execute()

        return {
            "county_id": county_id,
            "total": len(result.data),
            "offset": offset,
            "limit": limit,
            "petitions": result.data,
        }

    except Exception as e:
        logger.error(f"Error fetching petitions for {county_id}: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/counties/{county_id}/petitions/{petition_number}")
async def get_petition(county_id: str, petition_number: str):
    """Get a single petition by number"""
    if not supabase:
        raise HTTPException(status_code=500, detail="Database not configured")

    try:
        result = (
            supabase.table("petitions")
            .select("*")
            .eq("county_id", county_id)
            .eq("petition_number", petition_number)
            .execute()
        )

        if not result.data:
            raise HTTPException(
                status_code=404,
                detail=f"Petition {petition_number} not found in {county_id}",
            )

        return result.data[0]

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching petition {petition_number}: {e}")
        raise HTTPException(status_code=500, detail=str(e))
