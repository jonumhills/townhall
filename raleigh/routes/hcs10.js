/**
 * routes/hcs10.js
 *
 * HCS-10 Agent Listener
 *
 * Polls the Townhall AI's HCS inbox topic for incoming messages.
 * For each message it:
 *   1. Handles connection requests (auto-confirms per HCS-10 spec)
 *   2. Forwards chat messages to the FastAPI /api/chat backend (Claude)
 *   3. Sends the AI reply back to the sender via their reply topic
 *
 * Runs as a background loop started by server.js.
 */

import { existsSync, readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import {
  HCS10Client,
} from '@hashgraphonline/standards-sdk';

const __dirname = dirname(fileURLToPath(import.meta.url));
const STATE_FILE = join(__dirname, '..', 'agent-state.json');

const MIRROR_BASE  = 'https://testnet.mirrornode.hedera.com';
const AI_BACKEND   = process.env.AI_BACKEND_URL || 'http://localhost:8000/api/chat';
const POLL_MS      = 5_000;   // poll every 5 seconds
const COUNTY_ID    = process.env.DEFAULT_COUNTY_ID || 'raleigh_nc';

// Track last seen sequence per topic so we don't reprocess messages
const lastSeq = new Map();

/** Load agent state saved by register-agent.js */
function loadState() {
  if (!existsSync(STATE_FILE)) return null;
  return JSON.parse(readFileSync(STATE_FILE, 'utf-8'));
}

/** Fetch new HCS topic messages since last seen sequence */
async function fetchNewMessages(topicId) {
  const seq = lastSeq.get(topicId) || 0;
  const url = `${MIRROR_BASE}/api/v1/topics/${topicId}/messages?sequenceNumber=gt:${seq}&limit=25&order=asc`;
  const res = await fetch(url);
  if (!res.ok) return [];
  const data = await res.json();
  return data.messages || [];
}

/** Decode base64 message content */
function decodeMessage(raw) {
  try {
    return JSON.parse(Buffer.from(raw, 'base64').toString('utf-8'));
  } catch {
    return null;
  }
}

/** Send a message to an HCS topic via the Townhall agent's HCS10Client */
async function sendHcsReply(client, topicId, payload) {
  try {
    await client.sendMessage(topicId, JSON.stringify(payload), 'townhall-ai-reply');
    console.log(`[HCS-10] Replied to topic ${topicId}`);
  } catch (err) {
    console.error(`[HCS-10] Failed to send reply to ${topicId}:`, err.message);
  }
}

/** Call the Townhall AI backend (Claude) with a natural-language question */
async function callAI(question, conversationHistory = []) {
  try {
    const res = await fetch(AI_BACKEND, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: question,
        county_id: COUNTY_ID,
        conversation_history: conversationHistory,
        // A2A calls bypass the x402 payment gate (internal call from same server)
        _internal_agent_call: true,
      }),
      timeout: 30_000,
    });

    if (!res.ok) {
      const text = await res.text();
      console.error('[HCS-10] AI backend error:', res.status, text);
      return `I'm having trouble processing that right now (backend ${res.status}).`;
    }

    const data = await res.json();
    return data.reply || 'No response generated.';
  } catch (err) {
    console.error('[HCS-10] AI backend call failed:', err.message);
    return `I encountered an error: ${err.message}`;
  }
}

/** Process a single HCS-10 message */
async function processMessage(client, agentState, msg) {
  const seq = msg.sequence_number;
  const topicId = agentState.inboundTopicId;

  const payload = decodeMessage(msg.message);
  if (!payload) {
    console.log(`[HCS-10] seq ${seq}: could not decode message`);
    return;
  }

  const { p, op, operator_id, data, m } = payload;

  // Only process HCS-10 messages
  if (p !== 'hcs-10') return;

  console.log(`[HCS-10] seq ${seq} op=${op} from=${operator_id}`);

  // ── Connection request ──────────────────────────────────────────────────────
  if (op === 'connection_request') {
    try {
      const connReq = typeof data === 'string' ? JSON.parse(data) : data;
      const connectionTopicId = connReq?.connection_topic_id;

      if (!connectionTopicId) {
        console.warn('[HCS-10] connection_request missing connection_topic_id');
        return;
      }

      console.log(`[HCS-10] Auto-confirming connection from ${operator_id} on topic ${connectionTopicId}`);
      await client.confirmConnection(topicId, connectionTopicId, operator_id);
      console.log(`[HCS-10] Connection confirmed with ${operator_id}`);
    } catch (err) {
      console.error('[HCS-10] Failed to confirm connection:', err.message);
    }
    return;
  }

  // ── Chat message ────────────────────────────────────────────────────────────
  if (op === 'message') {
    const question = typeof data === 'string' ? data : data?.text || JSON.stringify(data);
    const replyTopicId = payload.reply_topic_id || operator_id?.split('@')[1];

    console.log(`[HCS-10] Question from ${operator_id}: "${question.slice(0, 80)}"`);

    const answer = await callAI(question);

    if (replyTopicId) {
      await sendHcsReply(client, replyTopicId, {
        p:           'hcs-10',
        op:          'message',
        operator_id: `${agentState.accountId}@${agentState.inboundTopicId}`,
        data:        answer,
        m:           'townhall-ai-response',
      });
    } else {
      // If no reply topic, write to our outbound topic as a public response
      await sendHcsReply(client, agentState.outboundTopicId, {
        p:           'hcs-10',
        op:          'message',
        operator_id: `${agentState.accountId}@${agentState.inboundTopicId}`,
        data:        answer,
        in_reply_to: seq,
        m:           'townhall-ai-response',
      });
    }
    return;
  }

  console.log(`[HCS-10] seq ${seq}: unhandled op=${op}`);
}

/** Main polling loop */
export async function startHCS10Listener() {
  const agentState = loadState();
  if (!agentState) {
    console.warn('[HCS-10] agent-state.json not found — run `node scripts/register-agent.js` first');
    return;
  }

  const { HEDERA_ACCOUNT_ID, HEDERA_PRIVATE_KEY } = process.env;
  if (!HEDERA_ACCOUNT_ID || !HEDERA_PRIVATE_KEY) {
    console.warn('[HCS-10] HEDERA_ACCOUNT_ID / HEDERA_PRIVATE_KEY not set — listener disabled');
    return;
  }

  const client = new HCS10Client({
    network: 'testnet',
    operatorId: HEDERA_ACCOUNT_ID,
    operatorPrivateKey: HEDERA_PRIVATE_KEY,
    silent: true,
  });

  const { inboundTopicId } = agentState;
  console.log(`[HCS-10] Listening on inbox topic ${inboundTopicId} (poll every ${POLL_MS / 1000}s)`);

  // Seed last sequence to current tip so we don't replay history on startup
  try {
    const tip = await fetchNewMessages(inboundTopicId);
    if (tip.length > 0) {
      lastSeq.set(inboundTopicId, tip[tip.length - 1].sequence_number);
      console.log(`[HCS-10] Starting from sequence ${lastSeq.get(inboundTopicId)}`);
    }
  } catch {
    // fine — will start from 0
  }

  // Poll loop
  const poll = async () => {
    try {
      const messages = await fetchNewMessages(inboundTopicId);
      for (const msg of messages) {
        await processMessage(client, agentState, msg);
        lastSeq.set(inboundTopicId, msg.sequence_number);
      }
    } catch (err) {
      console.error('[HCS-10] Poll error:', err.message);
    } finally {
      setTimeout(poll, POLL_MS);
    }
  };

  poll();
}

/** Express route: GET /hcs10/status — shows agent info */
export function hcs10StatusRoute(req, res) {
  const state = loadState();
  if (!state) {
    return res.status(503).json({ error: 'Agent not registered yet. Run scripts/register-agent.js' });
  }
  res.json({
    status: 'active',
    agent:  'Townhall Intelligence',
    accountId:      state.accountId,
    inboundTopicId: state.inboundTopicId,
    outboundTopicId: state.outboundTopicId,
    profileTopicId:  state.profileTopicId,
    registeredAt:    state.registeredAt,
    holProfileUrl:   `https://hol.org/agent/${state.accountId}`,
    network:         'hedera-testnet',
  });
}
