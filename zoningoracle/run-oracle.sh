#!/bin/bash
# Zoning Oracle - Hourly Cron Workflow
# 1. Start Hedera API server
# 2. Run CRE simulation (fetches Supabase petitions, builds Merkle tree, writes to Hedera)
# 3. Stop API server

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
LOG_DIR="$SCRIPT_DIR/logs"
mkdir -p "$LOG_DIR"
LOG_FILE="$LOG_DIR/oracle-$(date +%Y%m%d-%H%M%S).log"

log() {
  echo "$1" | tee -a "$LOG_FILE"
}

log "========================================================================"
log "ZONING ORACLE - $(date -u +"%Y-%m-%dT%H:%M:%SZ")"
log "========================================================================"

# Step 1: Start Hedera API server
log ""
log "🔌 Starting Hedera API Server..."
cd "$SCRIPT_DIR/hedera-api"

lsof -ti:3000 | xargs kill -9 2>/dev/null || true
npm start >> "$LOG_FILE" 2>&1 &
API_PID=$!

sleep 3

if ! curl -s http://localhost:3000/health > /dev/null; then
  log "❌ API server failed to start"
  kill $API_PID 2>/dev/null || true
  exit 1
fi

log "✅ API Server running (PID: $API_PID)"

# Step 2: Run CRE simulation
log ""
log "📡 Running CRE Simulation..."
cd "$SCRIPT_DIR/cre-workflow"

SIMULATION_OUTPUT=$(cre workflow simulate zoning-oracle --target staging-settings --broadcast 2>&1)
echo "$SIMULATION_OUTPUT" >> "$LOG_FILE"

if echo "$SIMULATION_OUTPUT" | grep -q "✓ Workflow Simulation Result"; then
  log "✅ CRE Simulation completed"
else
  log "❌ CRE Simulation failed"
  kill $API_PID 2>/dev/null || true
  exit 1
fi

if echo "$SIMULATION_OUTPUT" | grep -q "Merkle root written to Hedera"; then
  log "✅ Merkle root written to Hedera"
else
  log "⚠️  Hedera write may have failed - check $LOG_FILE"
fi

PETITION_COUNT=$(echo "$SIMULATION_OUTPUT" | grep "Petitions fetched:" | tail -1 | awk '{print $NF}')
MERKLE_ROOT=$(echo "$SIMULATION_OUTPUT" | grep "Merkle root:" | tail -1 | awk '{print $NF}')

# Step 3: Stop API server
kill $API_PID 2>/dev/null || true

log ""
log "========================================================================"
log "✅ COMPLETE"
log "   Petitions: $PETITION_COUNT"
log "   Merkle Root: $MERKLE_ROOT"
log "   Log: $LOG_FILE"
log "   Hedera Contract: https://hashscan.io/testnet/contract/0x00000000000000000000000000000000007e1f8c"
log "========================================================================"
