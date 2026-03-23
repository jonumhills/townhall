# Townhall

> Real estate due diligence, powered by Hedera. Zoning history on-chain. AI-powered risk analysis. Cryptographic proof — in seconds instead of days.

Built for the **Hedera Future Origins Hackathon 2026**.

---

## The Problem

When lenders and RWA platforms (like Centrifuge) want to verify a land parcel, they hire third-party due diligence firms. That costs **$2,000+ per report** and takes **days**.

Even then, analysts manually search government websites, cross-reference zoning records, and piece together a picture from scattered data sources.

**Townhall makes this instant, on-chain, and verifiable.**

---

## What Townhall Does

**Three things:**

### 1. Zoning Oracle
Every rezoning petition, permit, and boundary change for Wake County, NC (434k+ parcels) is hashed into a Merkle tree. The root is anchored on the **Hedera EVM** smart contract — making every data point independently verifiable. No one can tamper with it.

### 2. Zoning Score
A 0–100 composite score — like a credit score, but for land. Calculated from:
- Zoning classification
- Rezoning stability (active petitions?)
- Documentation completeness (legislation URL on record?)
- Vote/action outcome (approved vs. denied)
- Search demand (how many users are researching this parcel)

Lenders use the score to make fast, defensible decisions without reading PDFs.

### 3. AI Agent
Ask any due diligence question in plain English — *"What are the rezoning risks for this parcel?"* — and get a structured AI analysis powered by Claude. Each query charges a **micro-HBAR payment via x402**. The agent is registered on the **HCS-10 OpenConvAI registry** on Moonscape.

---

## Hedera Features Used

| Feature | How Townhall Uses It |
|---|---|
| **Hedera EVM Smart Contract** | ZoningOracle stores Merkle root and zoning scores on-chain |
| **Hedera Consensus Service (HCS)** | Audit log — every zoning event written as a consensus message |
| **HCS-10 AI Agent** | Townhall Intelligence registered on Moonscape OpenConvAI registry |
| **x402 Micropayments** | AI chat queries metered in HBAR — pay per question |

**Smart Contract**
- Address: `0xa66f998b6F0Bf6792A8F5837c3D795211615F862`
- Network: Hedera Testnet (Chain ID: 296)
- Explorer: [HashScan](https://hashscan.io/testnet/contract/0xa66f998b6F0Bf6792A8F5837c3D795211615F862)

**HCS-10 AI Agent**
- Agent: [Moonscape — Townhall Intelligence](https://moonscape.tech/openconvai/agents/0.0.8336362)
- Inbound Topic: `0.0.8336371`
- Outbound Topic: `0.0.8336366`

---

## Stack

| Layer | Tech |
|---|---|
| Frontend | React 19 + Vite + TailwindCSS |
| Backend | FastAPI (Python) + Claude AI |
| Database | Supabase (PostgreSQL) |
| Maps | Mapbox GL JS + Wake County ArcGIS |
| Blockchain | Hedera EVM + HCS + ethers.js |

---

## Running Locally

```bash
# 1. Frontend
cd frontend && npm install && npm run dev

# 2. Backend (AI + API)
cd backend && pip install -r requirements.txt
uvicorn main:app --reload --port 8000

# 3. Hedera service (HCS-10 listener + oracle)
cd raleigh && npm install && npm run dev
```

Copy `.env.example` to `.env` and fill in your keys.

---

## Docs

Full Zoning Score methodology, Smart Contract API, and Hedera audit log format: [townhall.vercel.app/docs](https://townhall.vercel.app/docs)

---

## License

MIT
