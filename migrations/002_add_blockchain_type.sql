-- Migration: Add blockchain type support for multi-chain
-- Adds blockchain_type column to support both Hedera and ADI Chain

-- Add blockchain_type column
ALTER TABLE token_registry
ADD COLUMN IF NOT EXISTS blockchain_type TEXT DEFAULT 'hedera';

-- Add comment
COMMENT ON COLUMN token_registry.blockchain_type IS
'Blockchain network: hedera | adi';

-- Create index for efficient queries
CREATE INDEX IF NOT EXISTS idx_token_registry_blockchain
ON token_registry(blockchain_type, county_id);

-- Create composite index for common query patterns
CREATE INDEX IF NOT EXISTS idx_token_registry_verification
ON token_registry(county_id, blockchain_type, verification_status);

-- Update existing records to 'hedera' (Raleigh County)
UPDATE token_registry
SET blockchain_type = 'hedera'
WHERE blockchain_type IS NULL
  AND county_id = 'raleigh_nc';

-- Add validation check constraint
ALTER TABLE token_registry
ADD CONSTRAINT chk_blockchain_type
CHECK (blockchain_type IN ('hedera', 'adi'));

-- Migration complete
COMMENT ON TABLE token_registry IS
'Multi-chain token registry supporting Hedera (Raleigh) and ADI Chain (Durham)';
