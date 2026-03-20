-- Migration: Add price_adi column for ADI Chain pricing
-- Separates HBAR and ADI pricing to avoid confusion

-- Add price_adi column for ADI Chain prices
ALTER TABLE token_registry
ADD COLUMN IF NOT EXISTS price_adi NUMERIC;

-- Add comment
COMMENT ON COLUMN token_registry.price_adi IS
'Price per share in ADI tokens (for blockchain_type = adi)';

-- Add comment to existing price_hbar column for clarity
COMMENT ON COLUMN token_registry.price_hbar IS
'Price per share in HBAR tokens (for blockchain_type = hedera)';

-- Create index for price queries by blockchain type
CREATE INDEX IF NOT EXISTS idx_token_registry_prices
ON token_registry(blockchain_type, price_hbar, price_adi)
WHERE listed = true;

-- Add constraint: Only one price column should be set based on blockchain_type
-- This is informational - enforcement happens at application level
COMMENT ON COLUMN token_registry.blockchain_type IS
'Blockchain network: hedera (uses price_hbar) | adi (uses price_adi)';

-- Migration complete
