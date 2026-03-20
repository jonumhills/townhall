"""
Counties API Routes
"""
from fastapi import APIRouter, HTTPException
from typing import List
from loguru import logger

from api.models.response import CountyInfo
from api.utils.data_loader import DataLoader, get_available_counties, COUNTY_DISPLAY

router = APIRouter(prefix="/counties", tags=["counties"])


def _build_county_info(county_id: str) -> CountyInfo:
    loader = DataLoader(county_id)
    stats = loader.load_stats()
    display = COUNTY_DISPLAY.get(county_id, {"name": county_id, "state": ""})
    return CountyInfo(
        id=county_id,
        name=display["name"],
        state=display["state"],
        total_meetings=stats.get("total_meetings", 0),
        total_petitions=stats.get("total_petitions", 0),
        zoning_meetings=stats.get("zoning_meetings", 0),
        petitions_with_pins=stats.get("petitions_with_pins", 0),
        total_pins=stats.get("total_pins", 0),
        last_scrape=stats.get("last_scrape_time", ""),
    )


@router.get("/", response_model=List[CountyInfo])
async def list_counties():
    """Get list of all counties with statistics"""
    available = get_available_counties()
    result = []
    for county_id in available:
        try:
            result.append(_build_county_info(county_id))
        except Exception as e:
            logger.error(f"Error loading county {county_id}: {e}")
    return result


@router.get("/{county_id}", response_model=CountyInfo)
async def get_county(county_id: str):
    """Get county information and statistics"""
    try:
        return _build_county_info(county_id)
    except Exception as e:
        logger.error(f"Error loading county {county_id}: {e}")
        raise HTTPException(status_code=500, detail=str(e))
