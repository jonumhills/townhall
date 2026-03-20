"""
Statistics API Routes
"""
from fastapi import APIRouter
from loguru import logger

from api.models.response import StatsResponse, CountyInfo
from api.utils.data_loader import DataLoader, get_available_counties, COUNTY_DISPLAY

router = APIRouter(prefix="/stats", tags=["statistics"])


@router.get("/", response_model=StatsResponse)
async def get_aggregate_stats():
    """Get aggregated statistics across all counties"""
    available = get_available_counties()
    counties_data = []
    total_meetings = 0
    total_petitions = 0
    total_pins = 0

    for county_id in available:
        try:
            loader = DataLoader(county_id)
            stats = loader.load_stats()
            display = COUNTY_DISPLAY.get(county_id, {"name": county_id, "state": ""})

            county_info = CountyInfo(
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
            counties_data.append(county_info)

            total_meetings += stats.get("total_meetings", 0)
            total_petitions += stats.get("total_petitions", 0)
            total_pins += stats.get("total_pins", 0)

        except Exception as e:
            logger.error(f"Error loading county {county_id}: {e}")

    return StatsResponse(
        total_counties=len(counties_data),
        total_meetings=total_meetings,
        total_petitions=total_petitions,
        total_pins=total_pins,
        counties=counties_data,
    )
