import { PublicKey } from "@solana/web3.js";

export const PROGRAM_ID = new PublicKey(
  "5g9CxSn7N2iVJg6971vjMZBYR3KXwSVFuQe9P37JKSQy"
);

export const MARKETPLACE_SEED = Buffer.from("marketplace");
export const SERVICE_SEED = Buffer.from("service");
export const PAYMENT_SEED = Buffer.from("payment");

export const [MARKETPLACE_PDA] = PublicKey.findProgramAddressSync(
  [MARKETPLACE_SEED],
  PROGRAM_ID
);

export const RPC_URL =
  process.env.NEXT_PUBLIC_RPC_URL ?? "https://api.devnet.solana.com";

export const NETWORK =
  (process.env.NEXT_PUBLIC_NETWORK as "mainnet-beta" | "devnet" | "localnet") ??
  "devnet";
