/**
 * register-hol.js
 *
 * Registers Townhall Intelligence in the HOL Universal Registry (hol.org).
 *
 * The agent must already be registered on moonscape.tech via register-agent.js.
 * This script reads the existing agent-state.json for topic IDs and registers
 * the same agent on hol.org's registry under the hashgraph-online namespace.
 *
 * Cost: ~10 credits = ~1.11 HBAR (auto-purchased from your Hedera account).
 *
 * Usage:
 *   node scripts/register-hol.js
 */

import dotenv from 'dotenv';
import { existsSync, readFileSync, writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import {
  RegistryBrokerClient,
  AIAgentCapability,
  AIAgentType,
} from '@hashgraphonline/standards-sdk';

dotenv.config();

const __dirname = dirname(fileURLToPath(import.meta.url));
const STATE_FILE  = join(__dirname, '..', 'agent-state.json');
const HOL_FILE    = join(__dirname, '..', 'hol-state.json');

function loadState() {
  if (!existsSync(STATE_FILE)) {
    throw new Error('agent-state.json not found — run register-agent.js first');
  }
  return JSON.parse(readFileSync(STATE_FILE, 'utf-8'));
}

async function main() {
  const { HEDERA_ACCOUNT_ID, HEDERA_PRIVATE_KEY } = process.env;
  if (!HEDERA_ACCOUNT_ID || !HEDERA_PRIVATE_KEY) {
    throw new Error('HEDERA_ACCOUNT_ID and HEDERA_PRIVATE_KEY must be set');
  }

  // Check if already registered
  if (existsSync(HOL_FILE)) {
    const existing = JSON.parse(readFileSync(HOL_FILE, 'utf-8'));
    if (existing.uaid) {
      console.log('✅ Already registered on HOL!');
      console.log('  UAID      :', existing.uaid);
      console.log('  HOL URL   :', `https://hol.org/agent/${existing.uaid}`);
      console.log('  Registered:', existing.registeredAt);
      return;
    }
  }

  const agentState = loadState();
  const { inboundTopicId, outboundTopicId, agentAccountId } = agentState;

  if (!inboundTopicId || !outboundTopicId) {
    throw new Error('agent-state.json is missing topic IDs — re-run register-agent.js');
  }

  console.log('\nRegistering Townhall Intelligence on hol.org...');
  console.log('  Agent account :', agentAccountId || 'N/A');
  console.log('  Inbound topic :', inboundTopicId);
  console.log('  Outbound topic:', outboundTopicId);
  console.log('');

  const client = new RegistryBrokerClient({
    accountId:     HEDERA_ACCOUNT_ID,
    ledgerApiKey:  HEDERA_PRIVATE_KEY,
  });

  // Show quote first
  const profile = buildProfile(inboundTopicId, outboundTopicId);
  const payload  = buildPayload(profile, agentAccountId);

  const quote = await client.getRegistrationQuote(payload);
  console.log(`Credits needed : ${quote.requiredCredits} (~${quote.estimatedHbar?.toFixed(4)} HBAR)`);
  console.log(`Credits on hand: ${quote.availableCredits}`);

  if (quote.shortfallCredits > 0) {
    console.log(`Purchasing ${quote.shortfallCredits} credits from account ${HEDERA_ACCOUNT_ID}...`);
  }

  // Register with auto-topup — SDK automatically buys credits if needed
  console.log('\nSubmitting registration...');
  const result = await client.registerAgent(payload, {
    autoTopUp: {
      accountId:  HEDERA_ACCOUNT_ID,
      privateKey: HEDERA_PRIVATE_KEY,
    },
  });

  console.log('\nRegistration response:', JSON.stringify(result, null, 2));

  // Save state
  const holState = {
    uaid:         result.uaid || agentAccountId,
    attemptId:    result.attemptId,
    status:       result.status,
    registeredAt: new Date().toISOString(),
  };
  writeFileSync(HOL_FILE, JSON.stringify(holState, null, 2));

  console.log('\n✅ Registered on HOL!');
  if (holState.uaid) {
    console.log(`  HOL URL: https://hol.org/agent/${holState.uaid}`);
  }

  // If pending, wait for completion
  if (result.status === 'pending' && result.attemptId) {
    console.log('\nWaiting for registration to propagate...');
    try {
      const final = await client.waitForRegistrationCompletion(result.attemptId, {
        timeoutMs: 120_000,
        onProgress: (p) => console.log(`  [${p.status}] ${p.message || ''}`),
      });
      console.log('\nFinal status:', final.status);
      if (final.uaid) {
        holState.uaid = final.uaid;
        holState.status = final.status;
        writeFileSync(HOL_FILE, JSON.stringify(holState, null, 2));
        console.log(`  HOL URL: https://hol.org/agent/${final.uaid}`);
      }
    } catch (err) {
      console.warn('⚠️  Could not confirm final status:', err.message);
    }
  }
}

function buildProfile(inboundTopicId, outboundTopicId) {
  return {
    version:      '1.0',
    display_name: 'Townhall Intelligence',
    alias:        'townhall-ai',
    bio: (
      'AI-powered real estate intelligence: zoning analysis, parcel verification, ' +
      'rezoning trends and lender scoring on Hedera — Durham & Raleigh NC.'
    ),
    type:            1,  // AI_AGENT
    inboundTopicId,
    outboundTopicId,
    aiAgent: {
      type:         AIAgentType.AUTONOMOUS,
      capabilities: [
        AIAgentCapability.TEXT_GENERATION,
        AIAgentCapability.KNOWLEDGE_RETRIEVAL,
        AIAgentCapability.DATA_INTEGRATION,
        AIAgentCapability.MARKET_INTELLIGENCE,
        AIAgentCapability.SUMMARIZATION_EXTRACTION,
        AIAgentCapability.COMPLIANCE_ANALYSIS,
      ],
      model:   'claude-opus-4-6',
      creator: 'Townhall',
    },
  };
}

function buildPayload(profile, nativeId) {
  return {
    profile,
    protocol:              'openconvai',
    communicationProtocol: 'hcs-10',
    registry:              'hashgraph-online',
    metadata: {
      openConvAICompatible: true,
      ...(nativeId && { nativeId }),
    },
  };
}

main().catch((err) => {
  console.error('\nRegistration failed:', err.message || err);
  if (err.body) console.error('API response:', JSON.stringify(err.body));
  process.exit(1);
});
