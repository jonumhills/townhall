"""
Data Loader - Fetches data from Supabase
"""
import math
from typing import Dict, List, Optional
from loguru import logger

from api.utils.supabase_client import get_supabase


# Map county_id slugs used by the API to county_id values stored in Supabase
COUNTY_ID_MAP = {
    "charlotte_nc": "charlotte_nc",
    "durham_nc":    "durham_nc",
    "raleigh_nc":   "raleigh_nc",
}

COUNTY_DISPLAY = {
    "charlotte_nc": {"name": "Charlotte", "state": "NC"},
    "durham_nc":    {"name": "Durham",    "state": "NC"},
    "raleigh_nc":   {"name": "Raleigh",   "state": "NC"},
}


def _polygon_area_sqft(geometry: dict) -> Optional[float]:
    """
    Compute the area of a GeoJSON polygon in square feet using the spherical
    excess formula (accurate enough for small parcels).

    Supports Polygon and MultiPolygon geometry types.
    Returns None if geometry is missing or not a polygon type.
    """
    if not geometry:
        return None

    gtype = geometry.get("type", "")
    coords = geometry.get("coordinates")
    if not coords:
        return None

    def ring_area_sq_meters(ring):
        """Shoelace on a geographic ring — returns area in m²."""
        n = len(ring)
        if n < 3:
            return 0.0
        # Convert degrees to radians for the spherical formula
        R = 6_378_137.0  # Earth radius in metres (WGS-84)
        area = 0.0
        for i in range(n):
            p1 = ring[i]
            p2 = ring[(i + 1) % n]
            lon1, lat1 = math.radians(p1[0]), math.radians(p1[1])
            lon2, lat2 = math.radians(p2[0]), math.radians(p2[1])
            area += (lon2 - lon1) * (2 + math.sin(lat1) + math.sin(lat2))
        area = abs(area) * R * R / 2.0
        return area

    SQ_METERS_TO_SQ_FT = 10.7639

    if gtype == "Polygon":
        # coords[0] is outer ring; rest are holes (subtract)
        total = ring_area_sq_meters(coords[0])
        for hole in coords[1:]:
            total -= ring_area_sq_meters(hole)
        return round(abs(total) * SQ_METERS_TO_SQ_FT, 1)

    if gtype == "MultiPolygon":
        total = 0.0
        for polygon in coords:
            total += ring_area_sq_meters(polygon[0])
            for hole in polygon[1:]:
                total -= ring_area_sq_meters(hole)
        return round(abs(total) * SQ_METERS_TO_SQ_FT, 1)

    return None


def _extract_area_sqft(raw_props: dict, geometry: dict) -> Optional[float]:
    """
    Try to get parcel area in sq ft.

    Priority:
    1. Known property fields that carry pre-computed area:
       - Charlotte: 'Shape.STArea()' (already in sq ft — it's a projected CRS value)
       - Durham:    'AREA_SQ_FT'
       - Generic:   'SHAPE_Area', 'Shape_Area', 'area_sqft'
    2. Compute from GeoJSON geometry using the spherical formula.
    """
    for key in ("AREA_SQ_FT", "Shape.STArea()", "SHAPE_Area", "Shape_Area", "area_sqft"):
        val = raw_props.get(key)
        if val is not None:
            try:
                return float(val)
            except (TypeError, ValueError):
                pass
    # Fall back: compute from geometry
    return _polygon_area_sqft(geometry)


def get_available_counties() -> List[str]:
    """Return county_id slugs that have parcel data in Supabase."""
    try:
        sb = get_supabase()
        present = set()
        for cid in COUNTY_ID_MAP:
            res = (
                sb.table("parcels")
                .select("county_id")
                .eq("county_id", cid)
                .limit(1)
                .execute()
            )
            if res.data:
                present.add(cid)
        return sorted(present) if present else sorted(COUNTY_ID_MAP.keys())
    except Exception as e:
        logger.error(f"get_available_counties error: {e}")
        return sorted(COUNTY_ID_MAP.keys())


class DataLoader:
    """Load data from Supabase for a given county_id slug."""

    def __init__(self, county_id: str):
        self.county_id = county_id
        self.sb = get_supabase()

    def load_stats(self) -> Dict:
        """Compute stats by querying Supabase."""
        try:
            pet_res = (
                self.sb.table("petitions")
                .select("petition_id", count="exact")
                .eq("county_id", self.county_id)
                .execute()
            )
            total_petitions = pet_res.count or len(pet_res.data)

            pin_res = (
                self.sb.table("parcels")
                .select("id", count="exact")
                .eq("county_id", self.county_id)
                .execute()
            )
            total_pins = pin_res.count or len(pin_res.data)

            return {
                "total_meetings": 0,
                "total_petitions": total_petitions,
                "zoning_meetings": 0,
                "petitions_with_pins": total_petitions,
                "total_pins": total_pins,
                "last_scrape_time": "",
            }
        except Exception as e:
            logger.error(f"load_stats error for {self.county_id}: {e}")
            return {
                "total_meetings": 0,
                "total_petitions": 0,
                "zoning_meetings": 0,
                "petitions_with_pins": 0,
                "total_pins": 0,
                "last_scrape_time": "",
            }

    def load_parcels_geojson(self) -> Optional[Dict]:
        """
        Build a GeoJSON FeatureCollection from parcels + petitions tables.
        Each parcel row has a geometry (JSONB) column.
        Petition details are joined by petition_number / petition_id.
        """
        try:
            # Fetch only petition-linked parcels (not bulk ArcGIS parcels)
            # Petition parcels have petition_number like "Z-36-2023", "TCZ-1-2021"
            # ArcGIS bulk parcels have numeric PIN like "1744702010"
            parcels_res = (
                self.sb.table("parcels")
                .select("parcel_id, petition_id, petition_number, pin, geometry, properties")
                .eq("county_id", self.county_id)
                .not_.is_("petition_number", "null")
                .execute()
            )

            if not parcels_res.data:
                logger.warning(f"No parcels found for {self.county_id}")
                return {"type": "FeatureCollection", "features": []}

            # Fetch all petitions for this county
            pet_res = (
                self.sb.table("petitions")
                .select(
                    "petition_id, petition_number, file_number, location, address, "
                    "current_zoning, proposed_zoning, petitioner, status, action, "
                    "vote_result, meeting_date, meeting_type, legislation_url"
                )
                .eq("county_id", self.county_id)
                .execute()
            )

            # Index petitions by both petition_number and petition_id
            pet_by_number: Dict = {}
            pet_by_id: Dict = {}
            for p in (pet_res.data or []):
                if p.get("petition_number"):
                    pet_by_number[p["petition_number"]] = p
                if p.get("petition_id"):
                    pet_by_id[p["petition_id"]] = p

            features = []
            for parcel in parcels_res.data:
                geometry = parcel.get("geometry")
                if not geometry:
                    continue

                petition = (
                    pet_by_number.get(parcel.get("petition_number"))
                    or pet_by_id.get(parcel.get("petition_id"))
                    or {}
                )

                meeting_date = petition.get("meeting_date", "")
                if meeting_date and hasattr(meeting_date, "isoformat"):
                    meeting_date = meeting_date.isoformat()

                raw_props = parcel.get("properties") or {}
                if isinstance(raw_props, str):
                    import json as _json
                    try:
                        raw_props = _json.loads(raw_props)
                    except Exception:
                        raw_props = {}

                area_sqft = _extract_area_sqft(raw_props, geometry)

                props = {
                    "petition_number": petition.get("petition_number") or parcel.get("petition_number") or "",
                    "file_number":     petition.get("file_number", ""),
                    "pin":             parcel.get("pin", ""),
                    "location":        petition.get("location") or petition.get("address") or "",
                    "address":         petition.get("address", ""),
                    "current_zoning":  petition.get("current_zoning", ""),
                    "proposed_zoning": petition.get("proposed_zoning", ""),
                    "petitioner":      petition.get("petitioner", ""),
                    "status":          petition.get("status", ""),
                    "action":          petition.get("action", ""),
                    "vote_result":     petition.get("vote_result", ""),
                    "meeting_date":    meeting_date,
                    "meeting_type":    petition.get("meeting_type", ""),
                    "legislation_url": petition.get("legislation_url", ""),
                    "area_sqft":       area_sqft,
                }

                features.append({
                    "type": "Feature",
                    "geometry": geometry,
                    "properties": props,
                })

            logger.info(f"Built GeoJSON with {len(features)} features for {self.county_id}")
            return {"type": "FeatureCollection", "features": features}

        except Exception as e:
            logger.error(f"load_parcels_geojson error for {self.county_id}: {e}")
            return {"type": "FeatureCollection", "features": []}
