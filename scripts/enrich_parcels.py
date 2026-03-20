"""
enrich_parcels.py

Enriches existing parcels table rows with ArcGIS Wake County property data.

Strategy:
  - For each Raleigh parcel in Supabase, compute its centroid
  - Query ArcGIS with that centroid (geometry intersect) to find the matching lot
  - Write back: arcgis_pin, site_address, owner, land_val, geometry, etc.

Usage:
  python3 scripts/enrich_parcels.py              # enrich all raleigh_nc parcels
  python3 scripts/enrich_parcels.py --dry-run    # preview without writing
  python3 scripts/enrich_parcels.py --limit 20   # test on first 20
"""

import requests
import os
import json
import time
import argparse
from datetime import datetime, timezone
from typing import Optional

# ── Config ────────────────────────────────────────────────────────────────────
ARCGIS_URL = (
    "https://maps.wakegov.com/arcgis/rest/services"
    "/Property/Parcels/MapServer/0/query"
)
ARCGIS_FIELDS = ",".join([
    "PIN_NUM", "REID", "SITE_ADDRESS", "CITY", "ZIPNUM",
    "OWNER", "TOTAL_VALUE_ASSD", "LAND_VAL", "BLDG_VAL", "TOTSALPRICE",
    "HEATEDAREA", "CALC_AREA", "YEAR_BUILT", "UNITS",
    "TYPE_AND_USE", "LAND_CLASS", "DESIGN_STYLE_DECODE",
])

SUPABASE_URL = os.getenv("SUPABASE_URL", "https://dhdqxsrgdurcuadmbypj.supabase.co")
SUPABASE_KEY = os.getenv(
    "SUPABASE_KEY",
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRoZHF4c3JnZHVyY3VhZG1ieXBqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzAzMDA3NDUsImV4cCI6MjA4NTg3Njc0NX0.QxhgRS33CTDWWZvzmZ2Nv16mkLIPa4slPJ3_ZTcu3mU"
)
SUPABASE_HEADERS = {
    "apikey":        SUPABASE_KEY,
    "Authorization": f"Bearer {SUPABASE_KEY}",
    "Content-Type":  "application/json",
}

# ── Supabase helpers ──────────────────────────────────────────────────────────
def fetch_raleigh_parcels(limit: Optional[int] = None) -> list:
    """Fetch all raleigh_nc parcels that have geometry."""
    params = "select=id,pin,geometry,county_id&county_id=eq.raleigh_nc&geometry=not.is.null"
    if limit:
        params += f"&limit={limit}"
    r = requests.get(
        f"{SUPABASE_URL}/rest/v1/parcels?{params}",
        headers=SUPABASE_HEADERS,
        timeout=15,
    )
    r.raise_for_status()
    return r.json()


def patch_parcel(parcel_id: int, data: dict) -> bool:
    """PATCH a single parcel row by id."""
    r = requests.patch(
        f"{SUPABASE_URL}/rest/v1/parcels?id=eq.{parcel_id}",
        headers=SUPABASE_HEADERS,
        data=json.dumps(data),
        timeout=15,
    )
    return r.status_code in (200, 204)


# ── Geometry helpers ──────────────────────────────────────────────────────────
def centroid(geometry: dict) -> Optional[tuple]:
    """Compute centroid of a GeoJSON polygon (simple average of ring coords)."""
    try:
        coords = geometry["coordinates"][0]
        lngs = [c[0] for c in coords]
        lats = [c[1] for c in coords]
        return (sum(lngs) / len(lngs), sum(lats) / len(lats))
    except Exception:
        return None


# ── ArcGIS spatial query ──────────────────────────────────────────────────────
def query_arcgis_by_point(lng: float, lat: float) -> Optional[dict]:
    """
    Find the ArcGIS parcel whose polygon contains the given point.
    Uses geometryType=esriGeometryPoint + spatialRel=esriSpatialRelIntersects.
    """
    params = {
        "geometry":         f"{lng},{lat}",
        "geometryType":     "esriGeometryPoint",
        "inSR":             "4326",
        "spatialRel":       "esriSpatialRelIntersects",
        "outFields":        ARCGIS_FIELDS,
        "returnGeometry":   "true",
        "f":                "geojson",
        "resultRecordCount": 1,
    }
    try:
        r = requests.get(ARCGIS_URL, params=params, timeout=15)
        r.raise_for_status()
        features = r.json().get("features", [])
        return features[0] if features else None
    except Exception as e:
        print(f"    ArcGIS query failed: {e}")
        return None


# ── Transform ArcGIS feature → parcel patch ───────────────────────────────────
def build_patch(feature: dict) -> dict:
    p = feature.get("properties") or {}
    geom = feature.get("geometry")
    return {
        "arcgis_pin":        (p.get("PIN_NUM") or "").strip() or None,
        "reid":              p.get("REID"),
        "site_address":      p.get("SITE_ADDRESS"),
        "city":              p.get("CITY"),
        "zipcode":           str(p["ZIPNUM"]) if p.get("ZIPNUM") else None,
        "owner":             p.get("OWNER"),
        "total_value_assd":  p.get("TOTAL_VALUE_ASSD"),
        "land_val":          p.get("LAND_VAL"),
        "bldg_val":          p.get("BLDG_VAL"),
        "sale_price":        p.get("TOTSALPRICE"),
        "heated_area":       p.get("HEATEDAREA"),
        "calc_area":         p.get("CALC_AREA"),
        "year_built":        int(p["YEAR_BUILT"]) if p.get("YEAR_BUILT") else None,
        "units":             p.get("UNITS"),
        "type_and_use":      p.get("TYPE_AND_USE"),
        "land_class":        p.get("LAND_CLASS"),
        "design_style":      p.get("DESIGN_STYLE_DECODE"),
        "arcgis_geometry":   geom,
        "arcgis_enriched_at": datetime.now(timezone.utc).isoformat(),
    }


# ── Main ──────────────────────────────────────────────────────────────────────
def main():
    parser = argparse.ArgumentParser(description="Enrich Raleigh parcels with ArcGIS data")
    parser.add_argument("--dry-run", action="store_true", help="Preview without writing to DB")
    parser.add_argument("--limit",   type=int, default=None, help="Max parcels to process")
    args = parser.parse_args()

    print("━" * 60)
    print("  Townhall — ArcGIS Parcel Enrichment")
    print("━" * 60)
    print(f"  County  : raleigh_nc")
    print(f"  Dry run : {args.dry_run}")
    print(f"  Limit   : {args.limit or 'all'}")
    print()

    # 1. Fetch parcels needing enrichment
    print("📋 Fetching Raleigh parcels from Supabase...")
    parcels = fetch_raleigh_parcels(limit=args.limit)
    print(f"   Found {len(parcels)} parcels to enrich\n")

    if not parcels:
        print("Nothing to enrich — all parcels already have arcgis_pin set.")
        return

    # 2. Enrich each parcel
    matched   = 0
    not_found = 0
    errors    = 0

    for i, parcel in enumerate(parcels):
        pid    = parcel["id"]
        pin    = parcel["pin"]
        geom   = parcel.get("geometry")

        print(f"  [{i+1}/{len(parcels)}] id={pid}  pin={pin}", end=" ... ", flush=True)

        if not geom:
            print("⚠️  no geometry, skipping")
            not_found += 1
            continue

        # Compute centroid of the petition polygon
        center = centroid(geom)
        if not center:
            print("⚠️  centroid failed, skipping")
            not_found += 1
            continue

        # Query ArcGIS for the parcel at that point
        feature = query_arcgis_by_point(center[0], center[1])
        if not feature:
            print("❌ no ArcGIS match")
            not_found += 1
            time.sleep(0.1)
            continue

        patch = build_patch(feature)
        arcgis_pin = patch.get("arcgis_pin") or "?"
        address    = patch.get("site_address") or "—"
        print(f"✅ {arcgis_pin}  |  {address}")

        if not args.dry_run:
            ok = patch_parcel(pid, patch)
            if not ok:
                print(f"    ❌ DB write failed for id={pid}")
                errors += 1
                continue

        matched += 1
        time.sleep(0.05)   # 20 req/s max — be polite to ArcGIS

    # 3. Summary
    print()
    print("━" * 60)
    print(f"  ✅ Matched & written : {matched}")
    print(f"  ❌ No ArcGIS match   : {not_found}")
    print(f"  ⚠️  DB errors         : {errors}")
    print("━" * 60)


if __name__ == "__main__":
    main()
