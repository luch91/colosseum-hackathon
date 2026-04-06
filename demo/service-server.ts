/**
 * Demo API service with x402 payment gating.
 *
 * Endpoints:
 *   GET /health              — free, health check
 *   GET /api/prices          — gated, requires x402 payment
 *
 * Set env vars (output by register-service.ts) before running:
 *   SERVICE_PUBKEY, MARKETPLACE_PUBKEY, PROVIDER_PUBKEY, ADMIN_PUBKEY
 *   PRICE_LAMPORTS, PROGRAM_ID, RPC_URL
 *
 * Run: npm run demo:server
 */
import express from "express";
import { PublicKey } from "@solana/web3.js";
import { x402ExpressMiddleware, type ProviderConfig } from "../sdk/src/index";

const PORT = Number(process.env.PORT ?? 3001);

function required(name: string): string {
  const val = process.env[name];
  if (!val) throw new Error(`Missing env var: ${name}`);
  return val;
}

const config: ProviderConfig = {
  servicePubkey: required("SERVICE_PUBKEY"),
  marketplacePubkey: required("MARKETPLACE_PUBKEY"),
  providerPubkey: required("PROVIDER_PUBKEY"),
  adminPubkey: required("ADMIN_PUBKEY"),
  priceLamports: Number(process.env.PRICE_LAMPORTS ?? "10000"),
  network: "devnet",
  rpcUrl: process.env.RPC_URL ?? "https://api.devnet.solana.com",
  programId: process.env.PROGRAM_ID ?? "5g9CxSn7N2iVJg6971vjMZBYR3KXwSVFuQe9P37JKSQy",
};

// Validate pubkeys are well-formed
try {
  new PublicKey(config.servicePubkey);
  new PublicKey(config.marketplacePubkey);
} catch {
  throw new Error("SERVICE_PUBKEY or MARKETPLACE_PUBKEY is not a valid Solana address");
}

const app = express();
app.use(express.json());

// Free endpoint
app.get("/health", (_req, res) => {
  res.json({
    status: "ok",
    service: "AgentPay Demo: Crypto Prices",
    price_lamports: config.priceLamports,
    service_pda: config.servicePubkey,
  });
});

// Paid endpoint — gated by x402 middleware
app.get(
  "/api/prices",
  x402ExpressMiddleware(config),
  (_req, res) => {
    res.json({
      source: "AgentPay Demo",
      timestamp: new Date().toISOString(),
      prices: {
        SOL: { usd: 142.5 + Math.random() * 2 - 1, change_24h: 3.2 },
        BTC: { usd: 67430 + Math.random() * 200 - 100, change_24h: -0.8 },
        ETH: { usd: 3512 + Math.random() * 20 - 10, change_24h: 1.1 },
      },
    });
  }
);

app.listen(PORT, () => {
  console.log(`\nAgentPay demo service running on http://localhost:${PORT}`);
  console.log(`  Free:  GET /health`);
  console.log(`  Paid:  GET /api/prices  (${config.priceLamports} lamports/call)`);
  console.log(`  PDA:   ${config.servicePubkey}\n`);
});
