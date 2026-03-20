"""
fetch_parcels.py

Fetches ALL Wake County parcel records from ArcGIS REST API and
inserts them into the existing Supabase `parcels` table.

Each ArcGIS parcel becomes a new row keyed by real PIN_NUM,
separate from the petition-based rows already in the table.

Source:  https://maps.wakegov.com/arcgis/rest/services/Property/Parcels/MapServer/0
Total:   ~434,000 parcels

Usage:
  python3 scripts/fetch_parcels.py              # fetch all
  python3 scripts/fetch_parcels.py --dry-run    # preview, no DB write
  python3 scripts/fetch_parcels.py --limit 500  # test on 500
"""

import requests
import os
import sys
import json
import time
import argparse
from datetime import datetime, timezone
from typing import Optional, List

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

FETCH_BATCH  = 1000   # ArcGIS max records per request
UPSERT_BATCH = 200    # Supabase rows per upsert call
COUNTY_ID    = "raleigh_nc"
COUNTY_NAME  = "Raleigh"
STATE        = "north_carolina"

SUPABASE_URL = os.getenv("SUPABASE_URL", "https://dhdqxsrgdurcuadmbypj.supabase.co")
SUPABASE_KEY = os.getenv(
    "SUPABASE_KEY",
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRoZHF4c3JnZHVyY3VhZG1ieXBqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzAzMDA3NDUsImV4cCI6MjA4NTg3Njc0NX0.QxhgRS33CTDWWZvzmZ2Nv16mkLIPa4slPJ3_ZTcu3mU"
)
SUPABASE_HEADERS = {
    "apikey":        SUPABASE_KEY,
    "Authorization": f"Bearer {SUPABASE_KEY}",
    "Content-Type":  "application/json",
    "Prefer":        "resolution=merge-duplicates",
}

# ── ArcGIS fetch ──────────────────────────────────────────────────────────────
def fetch_page(offset: int, limit: int, retries: int = 3) -> list:
    params = {
        "where":             "1=1",
        "outFields":         ARCGIS_FIELDS,
        "returnGeometry":    "true",
        "f":                 "geojson",
        "resultOffset":      offset,
        "resultRecordCount": limit,
    }
    for attempt in range(retries):
        try:
            r = requests.get(ARCGIS_URL, params=params, timeout=60)
            r.raise_for_status()
            return r.json().get("features", [])
        except Exception as e:
            if attempt < retries - 1:
                wait = 5 * (attempt + 1)
                print(f" retry {attempt+1}/{retries} in {wait}s...", end=" ", flush=True)
                time.sleep(wait)
            else:
                raise


def fetch_all(max_records: Optional[int] = None, start_offset: int = 0) -> list:
    features = []
    offset = start_offset
    while True:
        limit = FETCH_BATCH
        if max_records:
            limit = min(FETCH_BATCH, max_records - len(features))

        print(f"  Fetching {offset}–{offset + limit - 1}...", end=" ", flush=True)
        page = fetch_page(offset, limit)
        print(f"{len(page)} records")

        if not page:
            break
        features.extend(page)
        offset += len(page)

        if max_records and len(features) >= max_records:
            break
        if len(page) < limit:
            break

        time.sleep(0.1)

    return features


# ── Transform ArcGIS feature → parcels table row ──────────────────────────────
def transform(feature: dict) -> Optional[dict]:
    p    = feature.get("properties") or {}
    geom = feature.get("geometry")

    pin = (p.get("PIN_NUM") or "").strip()
    if not pin:
        return None

    now = datetime.now(timezone.utc).isoformat()

    return {
        # ── Match existing parcels table schema ──
        "parcel_id":    f"raleigh_nc_{pin}",
        "pin":          pin,
        "state":        STATE,
        "county_id":    COUNTY_ID,
        "county_name":  COUNTY_NAME,
        "geometry":     geom,                      # primary geometry from ArcGIS
        "properties":   {                          # raw attributes in properties JSONB
            "PIN_NUM":          pin,
            "REID":             p.get("REID"),
            "SITE_ADDRESS":     p.get("SITE_ADDRESS"),
            "OWNER":            p.get("OWNER"),
            "TOTAL_VALUE_ASSD": p.get("TOTAL_VALUE_ASSD"),
            "LAND_VAL":         p.get("LAND_VAL"),
            "BLDG_VAL":         p.get("BLDG_VAL"),
            "HEATEDAREA":       p.get("HEATEDAREA"),
            "CALC_AREA":        p.get("CALC_AREA"),
            "YEAR_BUILT":       p.get("YEAR_BUILT"),
            "TYPE_AND_USE":     p.get("TYPE_AND_USE"),
            "LAND_CLASS":       p.get("LAND_CLASS"),
        },
        "scraped_at":   now,
        "created_at":   now,
        "updated_at":   now,

        # ── Enriched columns (from migration 008) ──
        "arcgis_pin":        pin,
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
        "arcgis_enriched_at": now,
    }


# ── Supabase upsert ───────────────────────────────────────────────────────────
def upsert_batch(records: list, retries: int = 5) -> int:
    import urllib3
    urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)
    for attempt in range(retries):
        try:
            r = requests.post(
                f"{SUPABASE_URL}/rest/v1/parcels?on_conflict=parcel_id",
                headers=SUPABASE_HEADERS,
                data=json.dumps(records),
                timeout=60,
                verify=False,
            )
            if r.status_code not in (200, 201):
                print(f"\n  ❌ Upsert failed ({r.status_code}): {r.text[:300]}")
                return 0
            return len(records)
        except Exception as e:
            if attempt < retries - 1:
                wait = 3 * (attempt + 1)
                print(f"\n  ⚠️  Upsert SSL/network error (attempt {attempt+1}/{retries}) — retrying in {wait}s...", flush=True)
                time.sleep(wait)
            else:
                print(f"\n  ❌ Upsert failed after {retries} attempts: {e}")
                return 0
    return 0


# ── Main ──────────────────────────────────────────────────────────────────────
def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument("--limit",   type=int, default=None)
    parser.add_argument("--offset",  type=int, default=0, help="Start offset (resume from this record)")
    args = parser.parse_args()

    print("━" * 60)
    print("  Townhall — Wake County ArcGIS Full Parcel Load")
    print("━" * 60)
    print(f"  Target  : Supabase parcels table ({COUNTY_ID})")
    print(f"  Offset  : {args.offset}")
    print(f"  Limit   : {args.limit or 'all (~434k)'}")
    print(f"  Dry run : {args.dry_run}")
    print()

    # Fetch → transform → upsert in a streaming loop (no full in-memory accumulation)
    print("📡 Fetching + upserting in streaming batches...")

    offset     = args.offset
    total_fetched  = 0
    total_upserted = 0
    total_skipped  = 0
    upsert_buffer: List[dict] = []

    dry_sample_shown = False

    while True:
        limit = FETCH_BATCH
        if args.limit:
            limit = min(FETCH_BATCH, args.limit - total_fetched)
            if limit <= 0:
                break

        print(f"  Fetching {offset}–{offset + limit - 1}...", end=" ", flush=True)
        page = fetch_page(offset, limit)
        print(f"{len(page)} records fetched", flush=True)

        if not page:
            break

        for feature in page:
            rec = transform(feature)
            if rec is None:
                total_skipped += 1
                continue
            upsert_buffer.append(rec)

        total_fetched += len(page)
        offset        += len(page)

        # Flush buffer to Supabase whenever we have enough rows
        while len(upsert_buffer) >= UPSERT_BATCH:
            batch = upsert_buffer[:UPSERT_BATCH]
            upsert_buffer = upsert_buffer[UPSERT_BATCH:]

            if args.dry_run:
                if not dry_sample_shown:
                    print("  Sample row (dry-run):")
                    sample = {k: v for k, v in batch[0].items() if k not in ("geometry", "arcgis_geometry")}
                    print(json.dumps(sample, indent=2, default=str))
                    dry_sample_shown = True
                total_upserted += len(batch)
            else:
                written = upsert_batch(batch)
                total_upserted += written
                print(f"  💾 Upserted {total_upserted:,} rows so far  (fetched {total_fetched:,}, skipped {total_skipped})", flush=True)

        if len(page) < limit:
            break

        time.sleep(0.1)

    # Flush remaining buffer
    if upsert_buffer:
        if args.dry_run:
            total_upserted += len(upsert_buffer)
        else:
            written = upsert_batch(upsert_buffer)
            total_upserted += written
            print(f"  💾 Upserted {total_upserted:,} rows so far  (fetched {total_fetched:,}, skipped {total_skipped})", flush=True)

    print()
    print(f"  ✅ {total_upserted:,} parcels upserted  ({total_skipped} skipped — no PIN)")
    print("━" * 60)


if __name__ == "__main__":
    main()
