# AgentPay

> Autonomous machine payments on Solana. Built for the Frontier Hackathon 2026.

AgentPay is a marketplace where AI agents pay for API services autonomously using the [x402 protocol](https://x402.org) — HTTP 402 Payment Required, settled on Solana in < 1 second.

## How It Works

```
Agent → GET /api/data
            ← 402 + X-Payment-Required: { service, price, provider }
Agent → pays on-chain (Solana tx, ~400ms)
Agent → GET /api/data + X-Payment-Proof: { tx_signature, request_hash }
            ← 200 + data
```

No human approval. No pre-authorization. No subscription management.  
Any agent with a funded wallet can pay any registered service in one round-trip.

## Architecture

```
programs/agentpay/     Anchor program — service registry, payment recording
sdk/                   TypeScript SDK — x402 client + provider middleware
app/                   Next.js marketplace UI
tests/                 Anchor integration tests
```

## Solana Program

Three accounts:

| Account | Purpose |
|---------|---------|
| `Marketplace` | Global registry config (admin, fee, volume stats) |
| `Service` | Provider's registered API (endpoint, price, call count) |
| `PaymentRecord` | Proof of payment for a specific request (prevents replay) |

Five instructions: `initialize`, `register_service`, `update_service_price`, `pay_for_service`, `consume_payment`

## Quick Start

### Prerequisites

```bash
# Install Solana CLI
sh -c "$(curl -sSfL https://release.anza.xyz/stable/install)"

# Install Anchor
cargo install --git https://github.com/coral-xyz/anchor avm --force
avm install 0.30.1 && avm use 0.30.1

# Install deps
npm install
cd app && npm install
cd ../sdk && npm install
```

### Build & Test

```bash
anchor build
anchor test
```

### Run the App

```bash
cd app
npm run dev
```

## SDK Usage

### As a paying agent (client)

```typescript
import { X402Client } from "@agentpay/sdk";

const client = new X402Client(connection, wallet, PROGRAM_ID);

// Automatically handles 402 — pays and retries
const response = await client.fetch("https://api.example.com/solana-price");
const data = await response.json();
```

### As a service provider (server)

```typescript
import { x402Middleware } from "@agentpay/sdk";

// Next.js middleware — wrap any route
export const middleware = x402Middleware({
  servicePubkey: SERVICE_PUBKEY,
  priceLamports: 1_000_000, // 0.001 SOL per call
  ...config,
});
```

## New Primitives Used

- **x402 Machine Payments** — HTTP 402-based autonomous payment protocol
- **Open Wallet Standard** — agent wallet key management (AES-256-GCM, BIP-39)
- **Solana** — 400ms finality, < $0.001 fees, making micropayments viable

## Competitive Gap

No existing project combines x402 + Solana + a service marketplace in a single deployable SDK.  
Payment rails for AI agents on Solana are currently manual, subscription-based, or custodial.  
AgentPay makes any HTTP endpoint payable in 2 lines of code.
