# Townhall

> **Real estate due diligence, powered by Hedera.**
> Zoning history on-chain. AI-powered risk analysis. Cryptographic proof — in seconds instead of days.

Built for the **[Hedera Future Origins Hackathon 2026](https://hedera.com/hackathon)**.

[![Smart Contract](https://img.shields.io/badge/Hedera%20Testnet-HashScan-8b5cf6?style=for-the-badge)](https://hashscan.io/testnet/contract/0xa66f998b6F0Bf6792A8F5837c3D795211615F862)
[![AI Agent](https://img.shields.io/badge/HCS--10%20Agent-Moonscape-00b8d4?style=for-the-badge)](https://moonscape.tech/openconvai/agents/0.0.8336362)

---

## The Problem

Blockchain lending platforms like **Centrifuge, Maple Finance, and Aave** tokenize real-world land as collateral. Before any loan is issued, they perform due diligence verifying zoning history, ownership records, and legal status of the parcel.

They do this by hiring human analysts. **It costs $2,000–$8,000 per report and takes 3–7 days.**

**Townhall solves this with Hedera making land due diligence instant, on-chain, and cryptographically verifiable.**

---

## What Townhall Does

Three components, each independently useful, together forming a complete due diligence layer for on-chain real estate.

### 🔮 1. Zoning Oracle

A **Chainlink CRE crawling agent** continuously monitors Wake County records for any zoning change — rezoning petitions, permit approvals, boundary updates, vote outcomes. When a change is detected, it brings that data on-chain through a two-step process:

1. **Merkle proof on Hedera EVM** — all newly changed petitions are hashed into a Merkle tree and the root is written to a Hedera EVM smart contract. Any tamper with the source data breaks the proof.
2. **Audit log on Hedera HCS** — every individual change event is written as a timestamped message to a **Hedera Consensus Service topic**, creating a permanent, immutable record of every mutation to the zoning dataset.

```
✅ Fetched 1,087 petitions from Wake County
🌳 Computing Merkle tree from petition data...
✅ Merkle root: 0x8868dcba448f9a66...
📡 Writing Merkle root to Hedera EVM...
✅ Transaction confirmed — Block 32,877,246
📋 Writing change events to HCS topic...
✅ Audit log updated on Hedera Consensus Service
```

The result: **every data point Townhall shows is traceable to a Hedera transaction.** Lenders can independently verify any claim without trusting Townhall as an intermediary.

---

### 🎯 2. Zoning Score

A **0–100 composite score** like a credit score, but for land. Lenders get a single, defensible number instead of a PDF.

| Factor | What It Measures |
|---|---|
| Zoning Classification | Residential, commercial, mixed-use risk profile |
| Rezoning Stability | Active petitions? Recent changes? |
| Documentation Completeness | Is the legislation URL on record? |
| Vote Outcome | Approved vs. denied history |
| HCS Verification Count | How many times independently verified on Hedera |
| Search Demand | How many lenders are researching this parcel |

> **The Hedera tick mark is the land's trust signal.** If a parcel has been written to HCS, it's verifiably audited the equivalent of a blue checkmark for real-world assets.

Every verification event is written as a **Hedera Consensus Service (HCS)** message, creating an immutable, timestamped audit trail that directly feeds the score.

---

### 🤖 3. AI Agent — Townhall Intelligence

Ask any due diligence question in plain English and get a structured risk analysis powered by **Claude AI**.

```
User: "What are the rezoning risks for parcel Z-29-2023?"

Townhall AI: "Z-29-2023 sits within a cluster of 5 related
RX-3-CU conversions in North Raleigh. Approval rate across
comparable petitions: 100%. Low risk — coordinated
neighborhood-level rezoning with no opposition history."
```

**How it works on Hedera:**
- Each query is metered via an **x402 micropayment in HBAR**  pay per question, no subscriptions
- The agent is registered on the **HCS-10 OpenConvAI registry** on Moonscape discoverable and callable by other agents or humans directly
- Highlighted parcels appear live on the interactive map as the AI identifies them

---

## Hedera Integration — In Depth

| Feature | Implementation | Live Link |
|---|---|---|
| **Hedera EVM Smart Contract** | `ZoningOracle.sol` stores Merkle root + zoning scores. Called on every oracle run. | [HashScan](https://hashscan.io/testnet/contract/0xa66f998b6F0Bf6792A8F5837c3D795211615F862) |
| **Hedera Consensus Service (HCS)** | Every parcel verification written as an HCS message. Forms the on-chain audit trail. Feeds the Zoning Score. `Topic 0.0.8323899` | [HCS Topic](https://hashscan.io/testnet/topic/0.0.8323899/messages?p=1&k=1774279870.739111000) |
| **HCS-10 AI Agent Registry** | Townhall Intelligence registered on Moonscape OpenConvAI registry. Inbound: `0.0.8336371` · Outbound: `0.0.8336366` | [Moonscape](https://moonscape.tech/openconvai/agents/0.0.8336362) |
| **x402 Micropayments** | AI chat queries cost micro-HBAR per message. Wallet-gated, metered at the API layer. | Live in app |

### Smart Contract

```
Address:  0xa66f998b6F0Bf6792A8F5837c3D795211615F862
Network:  Hedera Testnet (Chain ID: 296)
Explorer: hashscan.io/testnet/contract/0xa66f998b6F0Bf6792A8F5837c3D795211615F862
```

### HCS-10 AI Agent

```
Agent Account:   0.0.8336362
Inbound Topic:   0.0.8336371
Outbound Topic:  0.0.8336366
Registry:        Moonscape OpenConvAI
```

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        TOWNHALL                             │
│                                                             │
│  ┌─────────────┐    ┌──────────────┐    ┌───────────────┐  │
│  │  Lender     │    │  Maps Page   │    │  Zoning       │  │
│  │  Portal     │    │  (Mapbox)    │    │  Oracle       │  │
│  │  (React)    │    │  + AI Chat   │    │  (Cron)       │  │
│  └──────┬──────┘    └──────┬───────┘    └──────┬────────┘  │
│         │                  │                   │           │
│  ┌──────▼──────────────────▼───────────────────▼────────┐  │
│  │              FastAPI Backend (Python)                 │  │
│  │         Claude AI · Supabase · ArcGIS API             │  │
│  └──────────────────────────┬────────────────────────────┘  │
│                             │                              │
│  ┌──────────────────────────▼────────────────────────────┐  │
│  │                   HEDERA LAYER                        │  │
│  │                                                       │  │
│  │  EVM Smart Contract   HCS Audit Log   HCS-10 Agent    │  │
│  │  (Merkle root +       (verification   (x402 · AI      │  │
│  │   zoning scores)       timestamps)    micropayments)  │  │
│  └───────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

---

## Stack

| Layer | Tech |
|---|---|
| Frontend | React 19 + Vite + TailwindCSS + Framer Motion |
| Backend | FastAPI (Python) + Claude AI (Anthropic) |
| Database | Supabase (PostgreSQL) |
| Maps | Mapbox GL JS + Wake County ArcGIS (434k parcels) |
| Blockchain | Hedera EVM + HCS + ethers.js + x402 |
| Oracle | Chainlink CRE + Merkle tree computation |

---

## Running Locally

```bash
# Clone
git clone https://github.com/your-username/townhall
cd townhall

# 1. Frontend
cd frontend && npm install && npm run dev
# → http://localhost:5173

# 2. Backend (AI + API)
cd backend
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
# → http://localhost:8000

# 3. Oracle / Hedera service
cd raleigh
npm install && npm run dev
```

Copy `.env.example` to `.env` and fill in:

```bash
VITE_MAPBOX_TOKEN=        # Mapbox GL JS token
ANTHROPIC_API_KEY=        # Claude AI
SUPABASE_URL=             # Supabase project URL
SUPABASE_KEY=             # Supabase anon key
HEDERA_ACCOUNT_ID=        # Hedera testnet account
HEDERA_PRIVATE_KEY=       # Hedera testnet private key
VITE_API_BASE_URL=        # Backend URL
```

---

## Docs

Full Zoning Score methodology, Smart Contract ABI, and HCS audit log format:
**[townhall.vercel.app/docs](https://townhall-81fu-gfdp9lstg-manoj-srinivasas-projects.vercel.app/docs)**

---

## License

MIT
