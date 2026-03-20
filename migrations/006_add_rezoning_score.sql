-- Migration: Add rezoning score system to parcels
-- Provides a data-driven metric (0-100) for investment and lending decisions
--
-- Score factors:
--   - Zoning petition status (pending, approved, rejected)
--   - Location growth metrics
--   - Historical approval rate in area
--   - Time since petition filed
--   - Oracle data freshness

ALTER TABLE parcels
ADD COLUMN IF NOT EXISTS rezoning_score INTEGER
  CHECK (rezoning_score >= 0 AND rezoning_score <= 100),
ADD COLUMN IF NOT EXISTS rezoning_score_factors JSONB DEFAULT '{}',
ADD COLUMN IF NOT EXISTS rezoning_score_updated_at TIMESTAMPTZ;

-- Add index for high-score parcel queries
CREATE INDEX IF NOT EXISTS idx_parcels_rezoning_score
  ON parcels(rezoning_score DESC)
  WHERE rezoning_score IS NOT NULL;

-- Add index for score freshness queries
CREATE INDEX IF NOT EXISTS idx_parcels_score_updated_at
  ON parcels(rezoning_score_updated_at DESC);

-- Add composite index for county + score queries
CREATE INDEX IF NOT EXISTS idx_parcels_county_score
  ON parcels(county_id, rezoning_score DESC)
  WHERE rezoning_score IS NOT NULL;

COMMENT ON COLUMN parcels.rezoning_score IS
  'Data-driven rezoning potential score from 0-100. Higher = better investment potential';
COMMENT ON COLUMN parcels.rezoning_score_factors IS
  'JSONB breakdown of score components: {petition_status_points, location_growth_points, approval_rate_points, timing_points, oracle_freshness_points}';
COMMENT ON COLUMN parcels.rezoning_score_updated_at IS
  'Timestamp when rezoning score was last calculated';
