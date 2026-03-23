/**
 * register-agent.js
 *
 * Registers Townhall AI in the HOL Registry Broker.
 *
 * Resilient: saves state after each step so partial runs can resume.
 * Skips already-completed steps when re-run.
 *
 * Usage:
 *   node scripts/register-agent.js
 *
 * To resume after a partial run (reuses existing topics/account):
 *   node scripts/register-agent.js
 */

import dotenv from 'dotenv';
import { writeFileSync, existsSync, readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import {
  HCS10Client,
  AgentBuilder,
  AIAgentCapability,
  AIAgentType,
} from '@hashgraphonline/standards-sdk';

dotenv.config();

const __dirname = dirname(fileURLToPath(import.meta.url));
const STATE_FILE = join(__dirname, '..', 'agent-state.json');

function saveState(state) {
  writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
  console.log('  ✓ State saved to agent-state.json');
}

function loadState() {
  if (!existsSync(STATE_FILE)) return {};
  return JSON.parse(readFileSync(STATE_FILE, 'utf-8'));
}

async function withTimeout(promise, ms, label) {
  return Promise.race([
    promise,
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error(`${label} timed out after ${ms / 1000}s`)), ms)
    ),
  ]);
}

async function main() {
  const { HEDERA_ACCOUNT_ID, HEDERA_PRIVATE_KEY } = process.env;
  if (!HEDERA_ACCOUNT_ID || !HEDERA_PRIVATE_KEY) {
    throw new Error('HEDERA_ACCOUNT_ID and HEDERA_PRIVATE_KEY must be set');
  }

  const state = loadState();
  console.log('Current state:', state);

  const client = new HCS10Client({
    network: 'testnet',
    operatorId: HEDERA_ACCOUNT_ID,
    operatorPrivateKey: HEDERA_PRIVATE_KEY,
    logLevel: 'warn',
    silent: false,
  });

  const agentAccountId = state.agentAccountId || null;
  const agentPrivateKey = state.agentPrivateKey || null;

  // ── Step 1: Build agent profile ─────────────────────────────────────────────
  const builder = new AgentBuilder()
    .setName('Townhall Intelligence')
    .setAlias('townhall-ai')
    .setBio(
      'AI-powered real estate intelligence: zoning analysis, parcel verification, ' +
      'rezoning trends and lender scoring on Hedera — Durham & Raleigh NC.'
    )
    .setDescription(
      'Townhall Intelligence is an autonomous AI agent for real estate zoning data. ' +
      'Ask natural-language questions about rezoning petitions, parcel scores, or lender ' +
      'verification. Powered by Claude + live GIS data, gated by x402 HBAR micropayments.'
    )
    .setCapabilities([
      AIAgentCapability.TEXT_GENERATION,
      AIAgentCapability.KNOWLEDGE_RETRIEVAL,
      AIAgentCapability.DATA_INTEGRATION,
      AIAgentCapability.MARKET_INTELLIGENCE,
      AIAgentCapability.SUMMARIZATION_EXTRACTION,
      AIAgentCapability.COMPLIANCE_ANALYSIS,
    ])
    .setAgentType(AIAgentType.AUTONOMOUS)
    .setNetwork('testnet');

  // If we already created topics from a prior run, inject them
  if (state.inboundTopicId)  builder.setInboundTopicId(state.inboundTopicId);
  if (state.outboundTopicId) builder.setOutboundTopicId(state.outboundTopicId);
  if (agentAccountId)        builder.setExistingAccount(agentAccountId);

  // ── Step 2: Create/resume via createAndRegisterAgent with a 90s timeout ─────
  console.log('\nRegistering Townhall AI agent in HOL Registry...');
  console.log('(Topics already on-chain will be reused automatically)\n');

  const existingState = state.sdkState || {
    currentStage: 'init',
    completedPercentage: 0,
    createdResources: [],
    // Inject already-created topics so the SDK skips re-creating them
    ...(state.inboundTopicId  && { inboundTopicId:  state.inboundTopicId }),
    ...(state.outboundTopicId && { outboundTopicId: state.outboundTopicId }),
    ...(state.profileTopicId  && { profileTopicId:  state.profileTopicId }),
  };

  let result;
  try {
    result = await withTimeout(
      client.createAndRegisterAgent(builder, {
        progressCallback: ({ stage, message, progressPercent, details }) => {
          console.log(`[${String(progressPercent).padStart(3)}%] ${stage}: ${message}`);
          // Save partial state whenever the SDK tells us about new resources
          if (details?.state) {
            const s = details.state;
            const partial = {
              ...state,
              sdkState:       s,
              agentAccountId: s.agentAccount || state.agentAccountId,
              inboundTopicId: s.inboundTopicId  || state.inboundTopicId,
              outboundTopicId: s.outboundTopicId || state.outboundTopicId,
              profileTopicId:  s.profileTopicId  || state.profileTopicId,
            };
            saveState(partial);
          }
        },
        existingState,
      }),
      360_000,
      'createAndRegisterAgent',
    );
  } catch (err) {
    // If we timed out but topics exist, save what we have and continue
    console.warn(`\n⚠️  ${err.message}`);
    const current = loadState();
    if (current.inboundTopicId && current.outboundTopicId) {
      console.log('\nTopics already exist — saving partial state and continuing.');
      console.log('The agent is reachable via HCS-10 even without the profile inscription.');
      finalReport(current);
      return;
    }
    throw err;
  }

  // ── Step 3: Save final state ──────────────────────────────────────────────────
  const final = {
    accountId:       HEDERA_ACCOUNT_ID,
    agentAccountId:  result.agentAccountId || agentAccountId,
    inboundTopicId:  result.inboundTopicId,
    outboundTopicId: result.outboundTopicId,
    profileTopicId:  result.profileTopicId,
    registeredAt:    new Date().toISOString(),
  };
  saveState(final);
  finalReport(final);
}

function finalReport(state) {
  console.log('\n✅ Agent ready!');
  if (state.agentAccountId) console.log('  Agent account :', state.agentAccountId);
  if (state.inboundTopicId)  console.log('  Inbound topic :', state.inboundTopicId);
  if (state.outboundTopicId) console.log('  Outbound topic:', state.outboundTopicId);
  if (state.profileTopicId)  console.log('  Profile topic :', state.profileTopicId);
  const id = state.agentAccountId || state.accountId;
  if (id) console.log(`\n  HOL Registry  : https://moonscape.tech/openconvai/agents/${id}`);
  console.log('\n  Start the listener: npm run dev');
}

main().catch((err) => {
  console.error('\nRegistration failed:', err.message || err);
  process.exit(1);
});
