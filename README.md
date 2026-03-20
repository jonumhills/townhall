# Townhall

> On-chain land due diligence oracle — giving DeFi lenders and RWA tokenizers cryptographic proof of zoning history and parcel eligibility on Hedera.

Built for the **Hedera Future Origins Hackathon** — DeFi & Tokenization track.

---

## What it does

Townhall solves a critical gap in RWA lending: **due diligence is still done by humans, off-chain, in a PDF.** Townhall makes it programmable.

Any lending protocol, tokenization platform, or DeFi vault can call the Townhall ZoningOracle directly from their smart contract:

```solidity
IZoningOracle oracle = IZoningOracle(0xa66f998b6F0Bf6792A8F5837c3D795211615F862);

// Single-line collateral gate
require(oracle.isEligible(pin, 60), "Parcel not eligible");

// Dynamic LTV based on zoning score
(uint8 score,,) = oracle.getZoningScore(pin);
```

---

## Architecture

```
Wake County ArcGIS (434k parcels)
    ↓
Supabase (rezoning petitions + parcel data)
    ↓
Merkle Oracle (zoningoracle) → Hedera EVM Smart Contract
    ↓
ZoningOracle.isEligible(pin) ← called by any lending protocol
    ↓
Townhall Lender Dashboard + AI Chat + Maps
```

---

## Key Features

- **ZoningOracle** — deployed on Hedera EVM Testnet, callable by any smart contract
- **Merkle proof verification** — cryptographic data integrity via on-chain Merkle root
- **Zoning Score (0–100)** — composite score across 5 parameters for lending decisions
- **Hedera verified badge** — visual attestation on parcel map
- **Lender Dashboard** — full due diligence report with blockchain proof
- **AI Chat** — natural language queries over rezoning petition data
- **Wake County Maps** — 434k parcels rendered via Mapbox vector tiles

---

## Smart Contract

| | |
|--|--|
| **Address** | `0xa66f998b6F0Bf6792A8F5837c3D795211615F862` |
| **Network** | Hedera EVM Testnet (Chain ID: 296) |
| **Explorer** | [HashScan](https://hashscan.io/testnet/contract/0xa66f998b6F0Bf6792A8F5837c3D795211615F862) |

---

## Stack

| Layer | Tech |
|-------|------|
| Frontend | React 19 + Vite + TailwindCSS |
| Backend | FastAPI (Python) |
| Database | Supabase (PostgreSQL) |
| Maps | Mapbox GL JS + Vector Tiles |
| Blockchain | Hedera EVM, ethers.js |
| Oracle | Node.js + Merkle tree |
| Parcel Data | Wake County ArcGIS REST API |

---

## Getting Started

```bash
# Frontend
cd frontend && npm install && npm run dev

# Backend
cd backend && pip install -r requirements.txt
uvicorn api.main:app --reload --port 8000

# Oracle (zoningoracle project)
cd hedera-api && node server.js
```

Set environment variables from `.env.example`.

---

## Integration

See [/docs](https://townhall.vercel.app/docs) for the full Smart Contract API reference and integration examples for Centrifuge, Aave, Maple Finance, and Bonzo.

---

## License

MIT
