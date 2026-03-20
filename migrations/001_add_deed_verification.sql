-- Migration: Add deed verification columns to token_registry
-- Option A1: Manual document verification workflow
--
-- Adds columns for:
--   - deed_document_url: IPFS/S3 URL to uploaded deed PDF
--   - verification_status: pending | approved | rejected
--   - verification_notes: County legislator notes during review
--   - verified_by: Email/ID of county admin who approved/rejected
--   - verified_at: Timestamp of approval/rejection

ALTER TABLE token_registry
ADD COLUMN IF NOT EXISTS deed_document_url TEXT,
ADD COLUMN IF NOT EXISTS verification_status TEXT DEFAULT 'pending'
  CHECK (verification_status IN ('pending', 'approved', 'rejected')),
ADD COLUMN IF NOT EXISTS verification_notes TEXT,
ADD COLUMN IF NOT EXISTS verified_by TEXT,
ADD COLUMN IF NOT EXISTS verified_at TIMESTAMPTZ;

-- Add index for admin dashboard queries (filter by status, sort by created_at)
CREATE INDEX IF NOT EXISTS idx_token_registry_verification_status
  ON token_registry(verification_status, created_at DESC);

-- Add index for county admin filtering
CREATE INDEX IF NOT EXISTS idx_token_registry_county_verification
  ON token_registry(county_id, verification_status);

COMMENT ON COLUMN token_registry.deed_document_url IS
  'IPFS or S3 URL to uploaded deed document (PDF)';
COMMENT ON COLUMN token_registry.verification_status IS
  'Verification status: pending (waiting for county review), approved (county signed mint), rejected (invalid claim)';
COMMENT ON COLUMN token_registry.verification_notes IS
  'County legislator notes explaining approval or rejection';
COMMENT ON COLUMN token_registry.verified_by IS
  'Email or ID of county admin who reviewed the claim';
COMMENT ON COLUMN token_registry.verified_at IS
  'Timestamp when county admin approved or rejected the claim';
