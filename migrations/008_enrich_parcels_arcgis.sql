-- Migration: Add ArcGIS property columns to existing parcels table
--
-- Existing parcels table uses petition numbers as PINs and has minimal
-- properties. This migration adds columns for real parcel data from:
--   Wake County ArcGIS REST API
--   https://maps.wakegov.com/arcgis/rest/services/Property/Parcels/MapServer/0
--
-- After running this migration, execute:
--   python3 scripts/enrich_parcels.py
-- to spatially match and populate these columns for Raleigh parcels.

-- ── Add ArcGIS property columns ───────────────────────────────────────────────

ALTER TABLE parcels
  ADD COLUMN IF NOT EXISTS arcgis_pin        TEXT,         -- PIN_NUM from ArcGIS (real parcel PIN)
  ADD COLUMN IF NOT EXISTS reid              TEXT,         -- Real estate ID
  ADD COLUMN IF NOT EXISTS site_address      TEXT,         -- SITE_ADDRESS
  ADD COLUMN IF NOT EXISTS city              TEXT,         -- CITY
  ADD COLUMN IF NOT EXISTS zipcode           TEXT,         -- ZIPNUM
  ADD COLUMN IF NOT EXISTS owner             TEXT,         -- OWNER
  ADD COLUMN IF NOT EXISTS total_value_assd  NUMERIC,      -- TOTAL_VALUE_ASSD
  ADD COLUMN IF NOT EXISTS land_val          NUMERIC,      -- LAND_VAL
  ADD COLUMN IF NOT EXISTS bldg_val          NUMERIC,      -- BLDG_VAL
  ADD COLUMN IF NOT EXISTS sale_price        NUMERIC,      -- TOTSALPRICE
  ADD COLUMN IF NOT EXISTS heated_area       NUMERIC,      -- HEATEDAREA (sqft)
  ADD COLUMN IF NOT EXISTS calc_area         NUMERIC,      -- CALC_AREA (acres)
  ADD COLUMN IF NOT EXISTS year_built        SMALLINT,     -- YEAR_BUILT
  ADD COLUMN IF NOT EXISTS units             NUMERIC,      -- UNITS
  ADD COLUMN IF NOT EXISTS type_and_use      TEXT,         -- TYPE_AND_USE code
  ADD COLUMN IF NOT EXISTS land_class        TEXT,         -- LAND_CLASS
  ADD COLUMN IF NOT EXISTS design_style      TEXT,         -- DESIGN_STYLE_DECODE
  ADD COLUMN IF NOT EXISTS arcgis_geometry   JSONB,        -- exact lot boundary from ArcGIS
  ADD COLUMN IF NOT EXISTS arcgis_enriched_at TIMESTAMPTZ; -- when enrichment was last run

-- ── Indexes on new columns ────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_parcels_arcgis_pin
  ON parcels(arcgis_pin);

CREATE INDEX IF NOT EXISTS idx_parcels_site_address
  ON parcels(site_address);

CREATE INDEX IF NOT EXISTS idx_parcels_owner
  ON parcels(owner);

-- ── Comments ──────────────────────────────────────────────────────────────────

COMMENT ON COLUMN parcels.arcgis_pin IS
  'Real parcel PIN (PIN_NUM) from Wake County ArcGIS — differs from pin column which stores petition numbers';
COMMENT ON COLUMN parcels.arcgis_geometry IS
  'Exact parcel lot boundary polygon from ArcGIS. More precise than the petition-area geometry column.';
COMMENT ON COLUMN parcels.site_address IS
  'Street address from Wake County ArcGIS (SITE_ADDRESS field)';
COMMENT ON COLUMN parcels.total_value_assd IS
  'Total assessed value in USD from Wake County tax records';
COMMENT ON COLUMN parcels.heated_area IS
  'Heated building area in square feet (HEATEDAREA from ArcGIS)';
COMMENT ON COLUMN parcels.arcgis_enriched_at IS
  'Timestamp of last ArcGIS enrichment run for this parcel';
