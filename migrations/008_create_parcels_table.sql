-- Migration: Create parcels table with Wake County ArcGIS parcel geometry
--
-- Stores physical parcel (lot) data sourced from:
--   Wake County ArcGIS REST API:
--   https://maps.wakegov.com/arcgis/rest/services/Property/Parcels/MapServer/0
--
-- Relationship to petitions:
--   petitions (1) ──── (many) parcels
--   linked via pin column matching petitions.pins[] array elements
--
-- Run after creation:
--   python3 scripts/fetch_parcels.py   (loads all Wake County parcels)

CREATE TABLE IF NOT EXISTS parcels (
  -- ── Internal ──────────────────────────────────────────────────────────────
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- ── County context (mirrors petitions table) ──────────────────────────────
  state           TEXT NOT NULL DEFAULT 'north_carolina',
  county_id       TEXT NOT NULL,          -- e.g. 'raleigh_nc'
  county_name     TEXT NOT NULL,          -- e.g. 'Raleigh'

  -- ── Parcel identifier ─────────────────────────────────────────────────────
  pin             TEXT NOT NULL,          -- PIN_NUM from ArcGIS (e.g. '0716756963')
  reid            TEXT,                   -- Real estate ID (REID)

  -- ── Location ──────────────────────────────────────────────────────────────
  site_address    TEXT,                   -- SITE_ADDRESS
  city            TEXT,                   -- CITY
  zipcode         TEXT,                   -- ZIPNUM

  -- ── Ownership ─────────────────────────────────────────────────────────────
  owner           TEXT,                   -- OWNER

  -- ── Valuation ─────────────────────────────────────────────────────────────
  total_value_assd  NUMERIC,              -- TOTAL_VALUE_ASSD
  land_val          NUMERIC,              -- LAND_VAL
  bldg_val          NUMERIC,              -- BLDG_VAL
  sale_price        NUMERIC,              -- TOTSALPRICE

  -- ── Physical characteristics ──────────────────────────────────────────────
  heated_area     NUMERIC,               -- HEATEDAREA (sqft)
  calc_area       NUMERIC,               -- CALC_AREA (acres)
  year_built      SMALLINT,              -- YEAR_BUILT
  units           NUMERIC,               -- UNITS

  -- ── Classification ────────────────────────────────────────────────────────
  type_and_use    TEXT,                   -- TYPE_AND_USE code
  land_class      TEXT,                   -- LAND_CLASS
  design_style    TEXT,                   -- DESIGN_STYLE_DECODE

  -- ── Geometry ──────────────────────────────────────────────────────────────
  geometry        JSONB,                  -- GeoJSON polygon (from ArcGIS)

  -- ── Metadata ──────────────────────────────────────────────────────────────
  fetched_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ── Unique constraint: one record per PIN per county ──────────────────────────
ALTER TABLE parcels
  ADD CONSTRAINT uq_parcels_pin_county UNIQUE (pin, county_id);

-- ── Indexes ───────────────────────────────────────────────────────────────────

-- Primary lookup: by PIN
CREATE INDEX IF NOT EXISTS idx_parcels_pin
  ON parcels(pin);

-- County filter (most queries will scope to a county)
CREATE INDEX IF NOT EXISTS idx_parcels_county
  ON parcels(county_id);

-- Address search
CREATE INDEX IF NOT EXISTS idx_parcels_address
  ON parcels(site_address);

-- Owner search
CREATE INDEX IF NOT EXISTS idx_parcels_owner
  ON parcels(owner);

-- ── Comments ──────────────────────────────────────────────────────────────────
COMMENT ON TABLE parcels IS
  'Physical parcel (lot) records from Wake County ArcGIS, one row per PIN. Links to petitions via pin matching petitions.pins[].';

COMMENT ON COLUMN parcels.pin IS
  'Parcel PIN — matches PIN_NUM in Wake County ArcGIS and pins[] array in petitions table';
COMMENT ON COLUMN parcels.geometry IS
  'GeoJSON Polygon geometry of the parcel boundary, sourced from ArcGIS MapServer';
COMMENT ON COLUMN parcels.county_id IS
  'Matches county_id in petitions table (e.g. raleigh_nc)';
COMMENT ON COLUMN parcels.calc_area IS
  'Parcel area in acres as computed by ArcGIS';
COMMENT ON COLUMN parcels.heated_area IS
  'Heated building area in square feet (HEATEDAREA from ArcGIS)';
