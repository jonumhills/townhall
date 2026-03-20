"""
upload_tileset.py

Uploads parcels.mbtiles to Mapbox Tilesets API.

Mapbox Tilesets API flow:
  1. Create a tileset source  (upload raw GeoJSON line-delimited)
  2. Create a tileset         (if it doesn't exist)
  3. Create a tileset recipe  (how to tile the source)
  4. Publish the tileset      (triggers tiling job)
  5. Poll until complete

Usage:
  MAPBOX_TOKEN=sk.ey... python3 scripts/upload_tileset.py
  python3 scripts/upload_tileset.py --token sk.ey...
"""

import requests
import json
import time
import argparse
import os
import sys

# ── Config ────────────────────────────────────────────────────────────────────
MAPBOX_USERNAME = "manojsrinivasa"           # from pk.eyJ1IjoibWFub2pzcmluaXZhc2EiLi4u
TILESET_ID      = f"{MAPBOX_USERNAME}.wake-county-parcels"
SOURCE_ID       = "wake-county-parcels-src"
GEOJSON_FILE    = "scripts/wake_county_parcels.ndjson"

RECIPE = {
    "version": 1,
    "layers": {
        "parcels": {
            "source": f"mapbox://tileset-source/{MAPBOX_USERNAME}/{SOURCE_ID}",
            "minzoom": 10,
            "maxzoom": 16,
        }
    },
}


def api(method, path, token, **kwargs):
    url = f"https://api.mapbox.com{path}?access_token={token}"
    r = getattr(requests, method)(url, **kwargs)
    return r


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--token", default=os.getenv("MAPBOX_TOKEN"), help="Mapbox SECRET token (sk.ey...)")
    parser.add_argument("--geojson", default=GEOJSON_FILE)
    args = parser.parse_args()

    if not args.token or not args.token.startswith("sk."):
        print("❌  Need a Mapbox SECRET token (sk.ey...) — not the public pk token.")
        print("   Get one from: https://account.mapbox.com/access-tokens/")
        print("   Scopes needed: STYLES:TILES:READ, TILESETS:READ, TILESETS:WRITE, TILESETS:LIST")
        sys.exit(1)

    token = args.token

    print("━" * 60)
    print("  Townhall — Upload Parcels → Mapbox Tileset")
    print("━" * 60)
    print(f"  Username  : {MAPBOX_USERNAME}")
    print(f"  Tileset   : {TILESET_ID}")
    print(f"  Source    : {SOURCE_ID}")
    print(f"  GeoJSON   : {args.geojson}")
    print()

    # ── Step 1: Upload GeoJSON as tileset source ──────────────────────────────
    print("📤 Step 1: Uploading GeoJSON as tileset source…")
    if not os.path.exists(args.geojson):
        print(f"❌  {args.geojson} not found. Run export_parcels_geojson.py first.")
        sys.exit(1)

    size_mb = os.path.getsize(args.geojson) / 1_000_000
    print(f"   File size: {size_mb:.1f} MB")

    with open(args.geojson, "rb") as f:
        r = api(
            "post",
            f"/tilesets/v1/sources/{MAPBOX_USERNAME}/{SOURCE_ID}",
            token,
            files={"file": ("parcels.ndjson", f, "application/geo+json")},
        )

    if r.status_code not in (200, 201):
        print(f"❌  Source upload failed ({r.status_code}): {r.text[:400]}")
        sys.exit(1)

    print(f"   ✅ Source uploaded: {r.json().get('id')}")

    # ── Step 2: Create tileset (idempotent) ───────────────────────────────────
    print("\n🗂️  Step 2: Creating tileset…")
    r = api("post", f"/tilesets/v1/{TILESET_ID}", token, json={
        "recipe": RECIPE,
        "name": "Wake County Parcels",
        "description": "All Wake County NC parcel boundaries from ArcGIS",
        "private": False,
    })

    if r.status_code == 400 and "already exists" in r.text:
        print("   Tileset already exists — updating recipe…")
        r = api("patch", f"/tilesets/v1/{TILESET_ID}/recipe", token, json=RECIPE)
        if r.status_code not in (200, 201, 204):
            print(f"   ⚠️  Recipe update returned {r.status_code}: {r.text[:200]}")
    elif r.status_code not in (200, 201):
        print(f"❌  Tileset create failed ({r.status_code}): {r.text[:400]}")
        sys.exit(1)
    else:
        print(f"   ✅ Tileset created: {TILESET_ID}")

    # ── Step 3: Publish (start tiling job) ────────────────────────────────────
    print("\n🚀 Step 3: Publishing tileset (starts tiling job)…")
    r = api("post", f"/tilesets/v1/{TILESET_ID}/publish", token)
    if r.status_code not in (200, 201):
        print(f"❌  Publish failed ({r.status_code}): {r.text[:400]}")
        sys.exit(1)

    job_id = r.json().get("jobId", "unknown")
    print(f"   ✅ Job started: {job_id}")

    # ── Step 4: Poll job status ───────────────────────────────────────────────
    print("\n⏳ Step 4: Waiting for tiling to complete…")
    for attempt in range(60):
        time.sleep(10)
        r = api("get", f"/tilesets/v1/{TILESET_ID}/jobs/{job_id}", token)
        if r.status_code != 200:
            print(f"   Status check failed: {r.status_code}")
            continue

        status = r.json().get("stage", "unknown")
        print(f"   [{attempt*10}s] Status: {status}")

        if status == "success":
            print("\n  ✅ Tileset published successfully!")
            break
        elif status in ("failed", "superseded"):
            print(f"\n❌  Tiling job failed: {r.json()}")
            sys.exit(1)

    print()
    print("━" * 60)
    print("  Tileset ready! Add to your map:")
    print(f'  url: "mapbox://{TILESET_ID}"')
    print(f'  source-layer: "parcels"')
    print()
    print("  Update RaleighMap.jsx source to:")
    print(f'    type: "vector"')
    print(f'    url: "mapbox://{TILESET_ID}"')
    print("━" * 60)


if __name__ == "__main__":
    main()
