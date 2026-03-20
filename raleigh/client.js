import { Client, PrivateKey, AccountId } from "@hashgraph/sdk";
import dotenv from "dotenv";

dotenv.config();

// ── Platform operator singleton ───────────────────────────────────────────────
let _client = null;
let _operatorKey = null;
let _operatorId = null;

export function getClient() {
  if (_client) return _client;

  const accountId = process.env.HEDERA_ACCOUNT_ID;
  const privateKey = process.env.HEDERA_PRIVATE_KEY;

  if (!accountId || !privateKey) {
    throw new Error(
      "HEDERA_ACCOUNT_ID and HEDERA_PRIVATE_KEY must be set in .env"
    );
  }

  _operatorId = AccountId.fromString(accountId);
  _operatorKey = PrivateKey.fromStringECDSA(privateKey);

  const network = process.env.HEDERA_NETWORK || "testnet";

  if (network === "mainnet") {
    _client = Client.forMainnet();
  } else {
    _client = Client.forTestnet();
  }

  _client.setOperator(_operatorId, _operatorKey);

  console.log(`Hedera client initialized on ${network} for ${accountId}`);
  return _client;
}

export function getOperatorKey() {
  if (!_operatorKey) getClient();
  return _operatorKey;
}

export function getOperatorId() {
  if (!_operatorId) getClient();
  return _operatorId;
}

// ── County treasury accounts ──────────────────────────────────────────────────
// Each county has its own Hedera account that acts as the NFT treasury.
// The env var prefix matches the county_id with underscores uppercased.
// e.g. "raleigh_nc" → RALEIGH_NC_ACCOUNT_ID / RALEIGH_NC_PRIVATE_KEY

const COUNTY_ENV_PREFIX = {
  raleigh_nc:   "RALEIGH_NC",
  durham_nc:    "DURHAM_NC",
  charlotte_nc: "CHARLOTTE_NC",
};

/**
 * Returns the Hedera AccountId and PrivateKey for a county treasury.
 * @param {string} countyId - e.g. "raleigh_nc"
 * @returns {{ id: AccountId, key: PrivateKey }}
 */
export function getCountyAccount(countyId) {
  const prefix = COUNTY_ENV_PREFIX[countyId];
  if (!prefix) {
    throw new Error(`Unknown county: ${countyId}. Add it to COUNTY_ENV_PREFIX in client.js`);
  }

  const accountId = process.env[`${prefix}_ACCOUNT_ID`];
  const privateKey = process.env[`${prefix}_PRIVATE_KEY`];

  if (!accountId || accountId.startsWith("your_")) {
    throw new Error(`${prefix}_ACCOUNT_ID is not configured in .env`);
  }
  if (!privateKey || privateKey.startsWith("your_")) {
    throw new Error(`${prefix}_PRIVATE_KEY is not configured in .env`);
  }

  return {
    id:  AccountId.fromString(accountId),
    key: PrivateKey.fromStringECDSA(privateKey),
  };
}
