/**
 * audit.js — HCS Audit Log Route
 *
 * POST /audit/log
 * Submits a message to a Hedera Consensus Service topic.
 * Called by the Python backend after every lender verification.
 * The operator (Townhall) pays the HCS fee — lenders don't need HBAR.
 */
import express from 'express';
import {
  Client,
  AccountId,
  PrivateKey,
  TopicId,
  TopicMessageSubmitTransaction,
  TopicCreateTransaction,
} from '@hashgraph/sdk';

const router = express.Router();

function getClient() {
  const client = Client.forTestnet();
  client.setOperator(
    AccountId.fromString(process.env.HEDERA_ACCOUNT_ID),
    PrivateKey.fromStringECDSA(process.env.HEDERA_PRIVATE_KEY),
  );
  return client;
}

// ── POST /audit/log ────────────────────────────────────────────────────────────
router.post('/log', async (req, res) => {
  const { topic_id, message } = req.body;

  if (!topic_id || !message) {
    return res.status(400).json({ error: 'topic_id and message are required' });
  }
  if (!process.env.HEDERA_ACCOUNT_ID || !process.env.HEDERA_PRIVATE_KEY) {
    return res.status(503).json({ error: 'Hedera operator not configured' });
  }

  const client = getClient();
  try {
    const payload = typeof message === 'string' ? message : JSON.stringify(message);

    const tx = await new TopicMessageSubmitTransaction()
      .setTopicId(TopicId.fromString(topic_id))
      .setMessage(payload)
      .execute(client);

    const receipt = await tx.getReceipt(client);
    const sequenceNumber = receipt.topicSequenceNumber?.toNumber?.() ?? receipt.topicSequenceNumber;

    res.json({
      success:          true,
      sequence_number:  sequenceNumber,
      transaction_id:   tx.transactionId?.toString(),
      hashscan_url:     `https://hashscan.io/testnet/topic/${topic_id}`,
    });
  } catch (err) {
    console.error('[HCS audit] Submit failed:', err.message);
    res.status(500).json({ error: err.message });
  } finally {
    client.close();
  }
});

// ── POST /audit/create-topic ───────────────────────────────────────────────────
// One-time call to create the audit topic. Run once, save the returned topic_id to .env
router.post('/create-topic', async (_req, res) => {
  if (!process.env.HEDERA_ACCOUNT_ID || !process.env.HEDERA_PRIVATE_KEY) {
    return res.status(503).json({ error: 'Hedera operator not configured' });
  }
  const client = getClient();
  try {
    const tx = await new TopicCreateTransaction()
      .setTopicMemo('Townhall Lender Verification Audit Log')
      .execute(client);

    const receipt = await tx.getReceipt(client);
    const topicId = receipt.topicId.toString();

    res.json({
      success:      true,
      topic_id:     topicId,
      hashscan_url: `https://hashscan.io/testnet/topic/${topicId}`,
      note:         `Add HCS_LENDER_AUDIT_TOPIC_ID=${topicId} to your .env`,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  } finally {
    client.close();
  }
});

export default router;
