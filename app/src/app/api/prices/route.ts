import { NextRequest, NextResponse } from "next/server";
import { Connection, PublicKey } from "@solana/web3.js";

const RPC_URL = process.env.NEXT_PUBLIC_RPC_URL ?? "https://api.devnet.solana.com";
const PROGRAM_ID = "5g9CxSn7N2iVJg6971vjMZBYR3KXwSVFuQe9P37JKSQy";

// Hardcoded for the demo service registered in Phase 2
const PAYMENT_REQUIREMENTS = {
  service_pubkey: process.env.SERVICE_PUBKEY ?? "E4AD5Zr6QDfTH3qn5zwDkducUQREryWqFbFusBSwjF2o",
  marketplace_pubkey: "5wTnczmfP64ZjoTz1KmCuoQJawNnLtWCrTgGnqf953b6",
  provider_pubkey: process.env.PROVIDER_PUBKEY ?? "BV7Gd8ftjsFyy7P5iCShkspiA34YrDwNCPPiAHTZHFRR",
  admin_pubkey: "BV7Gd8ftjsFyy7P5iCShkspiA34YrDwNCPPiAHTZHFRR",
  price_lamports: 10_000,
  network: "devnet",
  program_id: PROGRAM_ID,
};

async function verifyProof(txSig: string): Promise<boolean> {
  const connection = new Connection(RPC_URL, "confirmed");
  try {
    const tx = await connection.getTransaction(txSig, {
      commitment: "confirmed",
      maxSupportedTransactionVersion: 0,
    });
    if (!tx || tx.meta?.err !== null) return false;

    const programId = new PublicKey(PROGRAM_ID);
    const accountKeys =
      tx.transaction.message.getAccountKeys?.().staticAccountKeys ??
      (tx.transaction.message as { accountKeys: PublicKey[] }).accountKeys;

    return accountKeys.some((k: PublicKey) => k.equals(programId));
  } catch {
    return false;
  }
}

export async function GET(request: NextRequest) {
  const proofHeader = request.headers.get("x-payment-proof");

  if (!proofHeader) {
    return NextResponse.json(
      { error: "Payment required", requirements: PAYMENT_REQUIREMENTS },
      {
        status: 402,
        headers: { "X-Payment-Required": JSON.stringify(PAYMENT_REQUIREMENTS) },
      }
    );
  }

  let proof: { tx_signature: string; request_hash: string };
  try {
    proof = JSON.parse(proofHeader);
  } catch {
    return NextResponse.json({ error: "Invalid X-Payment-Proof" }, { status: 400 });
  }

  const valid = await verifyProof(proof.tx_signature);
  if (!valid) {
    return NextResponse.json({ error: "Payment proof invalid or not confirmed" }, { status: 402 });
  }

  // Payment verified — serve the paid data
  return NextResponse.json({
    source: "AgentPay Demo API",
    timestamp: new Date().toISOString(),
    paid_with_tx: proof.tx_signature.slice(0, 16) + "…",
    prices: {
      SOL: { usd: +(141 + Math.random() * 4).toFixed(2), change_24h: +(Math.random() * 6 - 3).toFixed(2) },
      BTC: { usd: +(66000 + Math.random() * 2000).toFixed(0), change_24h: +(Math.random() * 4 - 2).toFixed(2) },
      ETH: { usd: +(3400 + Math.random() * 200).toFixed(0), change_24h: +(Math.random() * 4 - 2).toFixed(2) },
    },
  });
}
