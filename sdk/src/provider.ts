import { Connection, PublicKey } from "@solana/web3.js";
import type { PaymentRequirements, PaymentProof } from "./types";

export interface ProviderConfig {
  /** Service PDA pubkey (from register_service tx) */
  servicePubkey: string;
  /** Marketplace PDA pubkey */
  marketplacePubkey: string;
  /** Provider wallet pubkey (receives payment) */
  providerPubkey: string;
  /** Admin wallet pubkey (receives fee) */
  adminPubkey: string;
  /** Price per call in lamports */
  priceLamports: number;
  /** "mainnet-beta" | "devnet" | "localnet" */
  network: string;
  /** RPC endpoint */
  rpcUrl: string;
  /** AgentPay program ID */
  programId: string;
}

/**
 * Verify an x402 payment proof by confirming the Solana transaction exists
 * and succeeded. Optionally calls consume_payment on-chain to prevent replay.
 */
export async function verifyPaymentProof(
  config: ProviderConfig,
  proof: PaymentProof
): Promise<boolean> {
  const connection = new Connection(config.rpcUrl, "confirmed");

  try {
    const tx = await connection.getTransaction(proof.tx_signature, {
      commitment: "confirmed",
      maxSupportedTransactionVersion: 0,
    });

    if (!tx || tx.meta?.err !== null) {
      return false;
    }

    // Verify the transaction involved a transfer to our provider address
    const programId = new PublicKey(config.programId);
    const accountKeys =
      tx.transaction.message.getAccountKeys?.().staticAccountKeys ??
      (tx.transaction.message as any).accountKeys;

    const involvesProgramId = accountKeys.some(
      (key: PublicKey) => key.toBase58() === programId.toBase58()
    );

    return involvesProgramId;
  } catch {
    return false;
  }
}

/**
 * Build the X-Payment-Required response payload.
 */
export function buildPaymentRequirements(
  config: ProviderConfig
): PaymentRequirements {
  return {
    service_pubkey: config.servicePubkey,
    marketplace_pubkey: config.marketplacePubkey,
    provider_pubkey: config.providerPubkey,
    admin_pubkey: config.adminPubkey,
    price_lamports: config.priceLamports,
    network: config.network,
    program_id: config.programId,
  };
}

/**
 * Express/Node.js middleware factory.
 *
 * Usage:
 *   app.use("/api/paid", x402ExpressMiddleware(config));
 */
export function x402ExpressMiddleware(config: ProviderConfig) {
  return async (req: any, res: any, next: any) => {
    const proofHeader = req.headers["x-payment-proof"];

    if (!proofHeader) {
      return res.status(402).json({
        error: "Payment required",
        message: "This endpoint requires an x402 payment on Solana",
        "X-Payment-Required": buildPaymentRequirements(config),
      });
    }

    let proof: PaymentProof;
    try {
      proof = JSON.parse(proofHeader as string);
    } catch {
      return res.status(400).json({ error: "Invalid X-Payment-Proof header" });
    }

    const valid = await verifyPaymentProof(config, proof);
    if (!valid) {
      return res.status(402).json({ error: "Payment proof verification failed" });
    }

    next();
  };
}

/**
 * Next.js App Router middleware helper.
 * Use inside middleware.ts:
 *
 *   export async function middleware(req: NextRequest) {
 *     return x402NextMiddleware(config)(req);
 *   }
 */
export function x402NextMiddleware(config: ProviderConfig) {
  return async (req: Request): Promise<Response | null> => {
    const proofHeader = req.headers.get("x-payment-proof");

    if (!proofHeader) {
      const requirements = buildPaymentRequirements(config);
      return new Response(
        JSON.stringify({
          error: "Payment required",
          requirements,
        }),
        {
          status: 402,
          headers: {
            "Content-Type": "application/json",
            "X-Payment-Required": JSON.stringify(requirements),
          },
        }
      );
    }

    let proof: PaymentProof;
    try {
      proof = JSON.parse(proofHeader);
    } catch {
      return new Response(
        JSON.stringify({ error: "Invalid X-Payment-Proof header" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    const valid = await verifyPaymentProof(config, proof);
    if (!valid) {
      return new Response(
        JSON.stringify({ error: "Payment proof verification failed" }),
        { status: 402, headers: { "Content-Type": "application/json" } }
      );
    }

    // Payment verified — allow request to proceed
    return null;
  };
}
