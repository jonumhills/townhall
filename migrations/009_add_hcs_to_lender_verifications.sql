-- Migration: Add HCS audit columns to lender_verifications
-- Tracks which Hedera HCS topic/sequence number logged each verification

ALTER TABLE lender_verifications
  ADD COLUMN IF NOT EXISTS hcs_topic_id      VARCHAR(50),
  ADD COLUMN IF NOT EXISTS hcs_sequence_number BIGINT,
  ADD COLUMN IF NOT EXISTS hcs_transaction_id  VARCHAR(100);

COMMENT ON COLUMN lender_verifications.hcs_topic_id IS
  'Hedera HCS topic ID where the audit message was submitted (e.g. 0.0.5849321)';
COMMENT ON COLUMN lender_verifications.hcs_sequence_number IS
  'HCS message sequence number — use with topic ID to find the exact message on Hashscan';
COMMENT ON COLUMN lender_verifications.hcs_transaction_id IS
  'Hedera transaction ID for the HCS submit transaction';
