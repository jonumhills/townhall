-- Anti-replay table for x402 HBAR payments
-- Stores every tx hash that has already been used to pay for an AI chat message.
-- Prevents the same transaction from being replayed to get multiple responses.

CREATE TABLE IF NOT EXISTS used_payment_txns (
    tx_id    TEXT        PRIMARY KEY,          -- EVM tx hash (0x...) from MetaMask
    used_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Clean up entries older than 1 hour (payments expire after 5 min, so 1h is safe)
CREATE INDEX IF NOT EXISTS idx_used_payment_txns_used_at ON used_payment_txns (used_at);
