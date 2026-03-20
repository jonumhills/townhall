-- Migration: Add ADI price columns to share_holdings table
-- Adds blockchain_type and price_paid_adi columns to support multi-chain share tracking

-- Add blockchain_type column (if it doesn't exist)
ALTER TABLE share_holdings
ADD COLUMN IF NOT EXISTS blockchain_type TEXT DEFAULT 'hedera';

-- Add price_paid_adi column for ADI Chain purchases
ALTER TABLE share_holdings
ADD COLUMN IF NOT EXISTS price_paid_adi NUMERIC;

-- Add comments
COMMENT ON COLUMN share_holdings.blockchain_type IS
'Blockchain network: hedera | adi';

COMMENT ON COLUMN share_holdings.price_paid_adi IS
'Price paid per share in ADI tokens (for blockchain_type = adi)';

COMMENT ON COLUMN share_holdings.price_paid_hbar IS
'Price paid per share in HBAR tokens (for blockchain_type = hedera)';

-- Update existing records to 'hedera' (default)
UPDATE share_holdings
SET blockchain_type = 'hedera'
WHERE blockchain_type IS NULL;

-- Add validation check constraint
ALTER TABLE share_holdings
ADD CONSTRAINT chk_share_holdings_blockchain_type
CHECK (blockchain_type IN ('hedera', 'adi'));

-- Create index for efficient queries by blockchain type
CREATE INDEX IF NOT EXISTS idx_share_holdings_blockchain
ON share_holdings(blockchain_type, buyer_wallet);

-- Migration complete
COMMENT ON TABLE share_holdings IS
'Multi-chain share holdings tracking for Hedera (HBAR) and ADI Chain (ADI)';
