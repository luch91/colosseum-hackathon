/**
 * Multi-service demo server with x402 payment gating.
 *
 * Endpoints:
 *   GET /health              — free, lists all services
 *   GET /api/prices          — gated (10,000 lamports) — crypto prices
 *   GET /api/sentiment       — gated ( 5,000 lamports) — market sentiment
 *   GET /api/stats           — gated ( 8,000 lamports) — Solana network stats
 *
 * Service configs are loaded from keys/service-configs.json (written by
 * npm run register-demo-services). Falls back to env vars for the prices
 * service if the file is missing.
 *
 * Run: npm run demo:server
 */
import express from "express";
import * as fs from "fs";
import * as path from "path";
import { x402ExpressMiddleware, type ProviderConfig } from "../sdk/src/index";

const PORT = Number(process.env.PORT ?? 3001);
const CONFIGS_FILE = path.join(__dirname, "..", "keys", "service-configs.json");
const PROGRAM_ID = "5g9CxSn7N2iVJg6971vjMZBYR3KXwSVFuQe9P37JKSQy";
const RPC_URL = process.env.RPC_URL ?? "https://api.devnet.solana.com";

interface ServiceConfig {
  name: string;
  routePath: string;
  servicePubkey: string;
  marketplacePubkey: string;
  providerPubkey: string;
  adminPubkey: string;
  priceLamports: number;
}

function loadConfigs(): ServiceConfig[] {
  if (fs.existsSync(CONFIGS_FILE)) {
    return JSON.parse(fs.readFileSync(CONFIGS_FILE, "utf-8")) as ServiceConfig[];
  }

  // Fallback: single prices service from env vars
  function required(name: string): string {
    const val = process.env[name];
    if (!val) throw new Error(`Missing env var ${name} and keys/service-configs.json not found.\nRun: npm run register-demo-services`);
    return val;
  }
  return [
    {
      name: "AgentPay Demo: Crypto Prices",
      routePath: "/api/prices",
      servicePubkey: required("SERVICE_PUBKEY"),
      marketplacePubkey: required("MARKETPLACE_PUBKEY"),
      providerPubkey: required("PROVIDER_PUBKEY"),
      adminPubkey: required("ADMIN_PUBKEY"),
      priceLamports: Number(process.env.PRICE_LAMPORTS ?? "10000"),
    },
  ];
}

// ---------------------------------------------------------------------------
// Route handlers — one per service type
// ---------------------------------------------------------------------------

function pricesHandler(_req: express.Request, res: express.Response) {
  res.json({
    source: "AgentPay Demo",
    timestamp: new Date().toISOString(),
    prices: {
      SOL: { usd: +(141 + Math.random() * 4).toFixed(2), change_24h: +(Math.random() * 6 - 3).toFixed(2) },
      BTC: { usd: +(66000 + Math.random() * 2000).toFixed(0), change_24h: +(Math.random() * 4 - 2).toFixed(2) },
      ETH: { usd: +(3400 + Math.random() * 200).toFixed(0), change_24h: +(Math.random() * 4 - 2).toFixed(2) },
    },
  });
}

function sentimentHandler(_req: express.Request, res: express.Response) {
  const score = Math.floor(Math.random() * 100);
  res.json({
    source: "AgentPay Demo",
    timestamp: new Date().toISOString(),
    sentiment: {
      fear_greed_index: score,
      classification: score > 75 ? "Extreme Greed" : score > 55 ? "Greed" : score > 45 ? "Neutral" : score > 25 ? "Fear" : "Extreme Fear",
      whale_activity: ["accumulating", "distributing", "holding"][Math.floor(Math.random() * 3)],
      social_volume_24h: Math.floor(50000 + Math.random() * 30000),
      trend: score > 50 ? "bullish" : "bearish",
    },
  });
}

function statsHandler(_req: express.Request, res: express.Response) {
  res.json({
    source: "AgentPay Demo",
    timestamp: new Date().toISOString(),
    solana_stats: {
      tps_current: Math.floor(2800 + Math.random() * 400),
      tps_max_30d: 4891,
      slot_height: Math.floor(350000000 + Math.random() * 1000000),
      epoch: 742,
      validators_active: Math.floor(1950 + Math.random() * 50),
      total_stake_sol: 403_000_000 + Math.floor(Math.random() * 1_000_000),
      avg_block_time_ms: +(400 + Math.random() * 50).toFixed(0),
    },
  });
}

const HANDLERS: Record<string, express.RequestHandler> = {
  "/api/prices": pricesHandler,
  "/api/sentiment": sentimentHandler,
  "/api/stats": statsHandler,
};

// ---------------------------------------------------------------------------
// Server setup
// ---------------------------------------------------------------------------

const configs = loadConfigs();
const app = express();
app.use(express.json());

// Free health endpoint
app.get("/health", (_req, res) => {
  res.json({
    status: "ok",
    services: configs.map((c) => ({
      name: c.name,
      path: c.routePath,
      price_lamports: c.priceLamports,
      service_pda: c.servicePubkey,
    })),
  });
});

// Register one paid route per service
for (const cfg of configs) {
  const handler = HANDLERS[cfg.routePath];
  if (!handler) {
    console.warn(`No handler found for route ${cfg.routePath} — skipping`);
    continue;
  }

  const providerConfig: ProviderConfig = {
    servicePubkey: cfg.servicePubkey,
    marketplacePubkey: cfg.marketplacePubkey,
    providerPubkey: cfg.providerPubkey,
    adminPubkey: cfg.adminPubkey,
    priceLamports: cfg.priceLamports,
    network: "devnet",
    rpcUrl: RPC_URL,
    programId: PROGRAM_ID,
  };

  app.get(cfg.routePath, x402ExpressMiddleware(providerConfig), handler);
  console.log(`  Registered: GET ${cfg.routePath}  (${cfg.priceLamports} lamports)`);
}

app.listen(PORT, () => {
  console.log(`\nAgentPay multi-service demo running on http://localhost:${PORT}`);
  console.log(`  Free: GET /health`);
  for (const cfg of configs) {
    console.log(`  Paid: GET ${cfg.routePath}  (${cfg.priceLamports} lamports)  — ${cfg.name}`);
  }
  console.log();
});
