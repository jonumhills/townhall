import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import tokenizeRouter from "./routes/tokenize.js";
import marketRouter from "./routes/market.js";

dotenv.config();

const app = express();
const PORT = process.env.HEDERA_SERVICE_PORT || 3001;

app.use(cors());
app.use(express.json({ limit: '15mb' })); // Allow large base64-encoded deed documents

// ── Routes ───────────────────────────────────────────────────────────────────
app.use("/token", tokenizeRouter);
app.use("/market", marketRouter);

// ── Health ───────────────────────────────────────────────────────────────────
app.get("/health", (_req, res) => {
  res.json({
    status: "ok",
    network: process.env.HEDERA_NETWORK || "testnet",
    account: process.env.HEDERA_ACCOUNT_ID,
  });
});

app.listen(PORT, () => {
  console.log(`Hedera service running on http://localhost:${PORT}`);
  console.log(`Network : ${process.env.HEDERA_NETWORK || "testnet"}`);
  console.log(`Operator: ${process.env.HEDERA_ACCOUNT_ID}`);
  console.log("");
  console.log("Routes:");
  console.log("  POST /token/create       — create county NFT token (once)");
  console.log("  POST /token/verify-deed  — verify parcel PIN exists");
  console.log("  POST /token/mint         — mint NFT + shares for parcel");
  console.log("  GET  /token/tokenized    — list all tokenized parcels");
  console.log("  POST /market/list        — list shares for sale");
  console.log("  POST /market/buy         — buy shares");
  console.log("  GET  /market/listings    — all active listings");
  console.log("  GET  /market/portfolio/:wallet — wallet holdings");
});
