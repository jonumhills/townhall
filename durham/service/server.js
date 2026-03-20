import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import tokenizeRouter from "./routes/tokenize.js";
import marketRouter from "./routes/market.js";

dotenv.config();

const app = express();
const PORT = process.env.DURHAM_SERVICE_PORT || 3002;

app.use(cors());
app.use(express.json({ limit: '15mb' }));

// ── Routes ────────────────────────────────────────────────────────
app.use("/token", tokenizeRouter);
app.use("/market", marketRouter);

// ── Health ────────────────────────────────────────────────────────
app.get("/health", (_req, res) => {
  res.json({
    status: "ok",
    network: "ADI Testnet",
    chainId: process.env.ADI_CHAIN_ID,
    adminAddress: process.env.DURHAM_ADMIN_ADDRESS,
    contracts: {
      parcelNFT: process.env.PARCEL_NFT_ADDRESS,
      shareFactory: process.env.SHARE_TOKEN_FACTORY_ADDRESS,
      marketplace: process.env.MARKETPLACE_ADDRESS
    }
  });
});

app.listen(PORT, () => {
  console.log(`\n========================================`);
  console.log(`Durham ADI Service`);
  console.log(`========================================`);
  console.log(`Server:   http://localhost:${PORT}`);
  console.log(`Network:  ADI Testnet (Chain ID: ${process.env.ADI_CHAIN_ID})`);
  console.log(`Admin:    ${process.env.DURHAM_ADMIN_ADDRESS}`);
  console.log(`\nContracts:`);
  console.log(`  ParcelNFT:   ${process.env.PARCEL_NFT_ADDRESS}`);
  console.log(`  Factory:     ${process.env.SHARE_TOKEN_FACTORY_ADDRESS}`);
  console.log(`  Marketplace: ${process.env.MARKETPLACE_ADDRESS}`);
  console.log(`\nEndpoints:`);
  console.log(`  POST /token/verify-deed          — verify parcel PIN`);
  console.log(`  POST /token/submit-claim         — submit deed for review`);
  console.log(`  GET  /token/admin/pending-claims — pending claims (admin)`);
  console.log(`  POST /token/admin/approve-claim  — approve/reject (admin)`);
  console.log(`  GET  /token/tokenized            — list tokenized parcels`);
  console.log(`  POST /market/list                — list shares for sale`);
  console.log(`  POST /market/buy                 — purchase shares`);
  console.log(`  GET  /market/listings            — active listings`);
  console.log(`  GET  /market/portfolio/:wallet   — wallet holdings`);
  console.log(`  GET  /market/owned/:wallet       — owned parcels`);
  console.log(`========================================\n`);
});
