"""
Parcels API Routes - GeoJSON for map visualization
"""
from fastapi import APIRouter, HTTPException, Response
from loguru import logger
import json

from api.utils.data_loader import DataLoader

router = APIRouter(prefix="/counties/{county_id}/parcels", tags=["parcels"])


@router.get("/geojson")
async def get_parcels_geojson(county_id: str):
    """
    Get parcel polygons as GeoJSON for map visualization

    Returns a GeoJSON FeatureCollection with parcel geometries and petition metadata
    """
    try:
        loader = DataLoader(county_id)
        parcels_geojson = loader.load_parcels_geojson()

        return Response(
            content=json.dumps(parcels_geojson),
            media_type="application/geo+json"
        )

    except Exception as e:
        logger.error(f"Error loading parcels for {county_id}: {e}")
        raise HTTPException(status_code=500, detail=str(e))
