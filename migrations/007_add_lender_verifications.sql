-- Migration: Create lender_verifications table
-- Tracks verification requests from lending protocols checking parcel legitimacy
--
-- Use case: Lending protocols verify parcel data before approving loans

CREATE TABLE IF NOT EXISTS lender_verifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lender_wallet VARCHAR(255) NOT NULL,
  pin VARCHAR(50) NOT NULL,
  county_id VARCHAR(50) NOT NULL,
  verification_type VARCHAR(50) NOT NULL
    CHECK (verification_type IN ('oracle_check', 'deed_check', 'score_check', 'full_verification')),
  verification_result JSONB NOT NULL DEFAULT '{}',
  risk_level VARCHAR(20)
    CHECK (risk_level IN ('low', 'medium', 'high', 'critical')),
  verified_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Add index for lender wallet queries (view verification history)
CREATE INDEX IF NOT EXISTS idx_lender_verifications_wallet
  ON lender_verifications(lender_wallet, verified_at DESC);

-- Add index for parcel lookup (see who verified this parcel)
CREATE INDEX IF NOT EXISTS idx_lender_verifications_parcel
  ON lender_verifications(pin, county_id, verified_at DESC);

-- Add index for verification type analysis
CREATE INDEX IF NOT EXISTS idx_lender_verifications_type
  ON lender_verifications(verification_type, verified_at DESC);

COMMENT ON TABLE lender_verifications IS
  'Tracks verification requests from lending protocols checking parcel legitimacy before loan approval';
COMMENT ON COLUMN lender_verifications.lender_wallet IS
  'Wallet address of the lending protocol or lender conducting verification';
COMMENT ON COLUMN lender_verifications.pin IS
  'Parcel identification number being verified';
COMMENT ON COLUMN lender_verifications.verification_type IS
  'Type of verification: oracle_check (query oracle contract), deed_check (verify NFT deed), score_check (check rezoning score), full_verification (all checks)';
COMMENT ON COLUMN lender_verifications.verification_result IS
  'JSONB result containing: {deed_verified, oracle_status, oracle_data_hash, rezoning_score, risk_factors[], recommendations[]}';
COMMENT ON COLUMN lender_verifications.risk_level IS
  'Computed risk level: low (safe to lend), medium (moderate risk), high (risky), critical (do not lend)';
