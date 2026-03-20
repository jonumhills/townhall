"""
export_parcels_geojson.py

Fetches ALL Wake County parcels directly from ArcGIS REST API
and writes them to a GeoJSON file ready for tippecanoe tiling.

Bypasses Supabase entirely — ArcGIS is the source of truth and
doesn't have statement timeouts.

Usage:
  python3 scripts/export_parcels_geojson.py
  python3 scripts/export_parcels_geojson.py --out custom.geojson
  python3 scripts/export_parcels_geojson.py --offset 140000   # resume
"""

import requests
import json
import argparse
import time
import os

ARCGIS_URL = (
    "https://maps.wakegov.com/arcgis/rest/services"
    "/Property/Parcels/MapServer/0/query"
)

# Only the fields we need in the tileset (keep tiles small)
FIELDS = ",".join([
    "PIN_NUM", "SITE_ADDRESS", "OWNER",
    "TOTAL_VALUE_ASSD", "YEAR_BUILT", "HEATEDAREA", "TYPE_AND_USE",
])

PAGE_SIZE = 1000
MAX_FAILS = 5


def fetch_page(offset: int, retries: int = MAX_FAILS) -> list:
    params = {
        "where":             "1=1",
        "outFields":         FIELDS,
        "returnGeometry":    "true",
        "f":                 "geojson",
        "resultOffset":      offset,
        "resultRecordCount": PAGE_SIZE,
    }
    for attempt in range(retries):
        try:
            r = requests.get(ARCGIS_URL, params=params, timeout=60)
            r.raise_for_status()
            return r.json().get("features", [])
        except Exception as e:
            if attempt < retries - 1:
                wait = 5 * (attempt + 1)
                print(f"    retry {attempt+1}/{retries} in {wait}s — {e}", flush=True)
                time.sleep(wait)
            else:
                raise


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--out",    default="scripts/wake_county_parcels.geojson")
    parser.add_argument("--offset", type=int, default=0, help="Resume from this offset")
    args = parser.parse_args()

    print("━" * 60)
    print("  Townhall — ArcGIS → GeoJSON Export (Wake County)")
    print("━" * 60)
    print(f"  Output  : {args.out}")
    print(f"  Offset  : {args.offset}")
    print(f"  Source  : ArcGIS REST API (bypasses Supabase timeouts)")
    print()

    # If resuming, load existing features from disk
    features = []
    if args.offset > 0 and os.path.exists(args.out):
        print(f"  Resuming — loading existing {args.out}…", flush=True)
        with open(args.out) as f:
            existing = json.load(f)
        features = existing.get("features", [])
        print(f"  Loaded {len(features):,} existing features\n")

    offset = args.offset

    while True:
        print(f"  Fetching {offset:,}–{offset + PAGE_SIZE - 1:,}…", end=" ", flush=True)
        try:
            page = fetch_page(offset)
        except Exception as e:
            print(f"\n  ❌ Failed after {MAX_FAILS} retries: {e}")
            break

        if not page:
            print("0 records — done.")
            break

        for feat in page:
            p    = feat.get("properties") or {}
            geom = feat.get("geometry")
            pin  = (p.get("PIN_NUM") or "").strip()

            if not pin or not geom or not geom.get("coordinates"):
                continue

            features.append({
                "type": "Feature",
                "geometry": geom,
                "properties": {
                    "pin":              pin,
                    "site_address":     p.get("SITE_ADDRESS"),
                    "owner":            p.get("OWNER"),
                    "total_value_assd": p.get("TOTAL_VALUE_ASSD"),
                    "year_built":       p.get("YEAR_BUILT"),
                    "heated_area":      p.get("HEATEDAREA"),
                    "type_and_use":     p.get("TYPE_AND_USE"),
                },
            })

        print(f"{len(page)} records → {len(features):,} total", flush=True)

        offset += len(page)
        if len(page) < PAGE_SIZE:
            break

        # Save checkpoint every 50k features
        if len(features) % 50_000 < PAGE_SIZE:
            print(f"  💾 Checkpoint save at {len(features):,}…", flush=True)
            with open(args.out, "w") as f:
                json.dump({"type": "FeatureCollection", "features": features},
                          f, separators=(",", ":"))

        time.sleep(0.1)

    # Final write
    print(f"\n  Writing {len(features):,} features to {args.out}…", flush=True)
    with open(args.out, "w") as f:
        json.dump({"type": "FeatureCollection", "features": features},
                  f, separators=(",", ":"))

    size_mb = os.path.getsize(args.out) / 1_000_000
    print(f"  ✅ Done — {args.out} ({size_mb:.1f} MB, {len(features):,} features)")
    print()
    print("━" * 60)
    print("  Next steps:")
    print(f"  tippecanoe -o scripts/parcels.mbtiles \\")
    print(f"    --minimum-zoom=10 --maximum-zoom=16 \\")
    print(f"    --drop-densest-as-needed \\")
    print(f"    --layer=parcels \\")
    print(f"    {args.out}")
    print()
    print("  Then: MAPBOX_TOKEN=sk.ey... python3 scripts/upload_tileset.py")
    print("━" * 60)


if __name__ == "__main__":
    main()
