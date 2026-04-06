/**
 * Register a demo service on the AgentPay marketplace.
 * Safe to re-run — exits cleanly if service already registered.
 *
 * Outputs the service PDA and provider config needed by the demo server.
 */
import {
  Connection,
  Keypair,
  PublicKey,
  Transaction,
  TransactionInstruction,
  SystemProgram,
  sendAndConfirmTransaction,
} from "@solana/web3.js";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";

const PROGRAM_ID = new PublicKey("5g9CxSn7N2iVJg6971vjMZBYR3KXwSVFuQe9P37JKSQy");
const RPC_URL = process.env.RPC_URL ?? "https://api.devnet.solana.com";
const MARKETPLACE_SEED = Buffer.from("marketplace");
const SERVICE_SEED = Buffer.from("service");

// Service configuration — edit to taste
const SERVICE_NAME = process.env.SERVICE_NAME ?? "AgentPay Demo: Crypto Prices";
const SERVICE_ENDPOINT = process.env.SERVICE_ENDPOINT ?? "http://localhost:3001/api/prices";
const SERVICE_DESCRIPTION = "Real-time crypto price data. Pay-per-call via x402 on Solana.";
const PRICE_LAMPORTS = BigInt(process.env.PRICE_LAMPORTS ?? "10000"); // 0.00001 SOL

function encodeString(str: string): Buffer {
  const bytes = Buffer.from(str, "utf-8");
  const len = Buffer.alloc(4);
  len.writeUInt32LE(bytes.length, 0);
  return Buffer.concat([len, bytes]);
}

async function main() {
  const connection = new Connection(RPC_URL, "confirmed");

  const keypairPath = path.join(os.homedir(), ".config", "solana", "id.json");
  const provider = Keypair.fromSecretKey(
    Uint8Array.from(JSON.parse(fs.readFileSync(keypairPath, "utf-8")))
  );

  const [marketplacePda] = PublicKey.findProgramAddressSync(
    [MARKETPLACE_SEED],
    PROGRAM_ID
  );
  const [servicePda] = PublicKey.findProgramAddressSync(
    [SERVICE_SEED, provider.publicKey.toBuffer()],
    PROGRAM_ID
  );

  console.log("Provider:       ", provider.publicKey.toBase58());
  console.log("Marketplace PDA:", marketplacePda.toBase58());
  console.log("Service PDA:    ", servicePda.toBase58());

  const existing = await connection.getAccountInfo(servicePda);
  if (existing) {
    console.log("\nService already registered — outputting config.\n");
    printConfig(provider.publicKey, servicePda, marketplacePda);
    return;
  }

  // Discriminator = sha256("global:register_service")[0..8]
  const discriminator = Buffer.from([0x0b, 0x85, 0x9e, 0xe8, 0xc1, 0x13, 0xe5, 0x49]);

  const priceData = Buffer.alloc(8);
  priceData.writeBigUInt64LE(PRICE_LAMPORTS, 0);

  const ix = new TransactionInstruction({
    keys: [
      { pubkey: servicePda, isSigner: false, isWritable: true },
      { pubkey: marketplacePda, isSigner: false, isWritable: true },
      { pubkey: provider.publicKey, isSigner: true, isWritable: true },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ],
    programId: PROGRAM_ID,
    data: Buffer.concat([
      discriminator,
      encodeString(SERVICE_NAME),
      encodeString(SERVICE_ENDPOINT),
      encodeString(SERVICE_DESCRIPTION),
      priceData,
    ]),
  });

  const sig = await sendAndConfirmTransaction(
    connection,
    new Transaction().add(ix),
    [provider],
    { commitment: "confirmed" }
  );

  console.log("\n✓ Service registered!");
  console.log("Signature:", sig);
  console.log("");
  printConfig(provider.publicKey, servicePda, marketplacePda);
}

function printConfig(
  providerPubkey: PublicKey,
  servicePda: PublicKey,
  marketplacePda: PublicKey
) {
  const config = {
    SERVICE_PUBKEY: servicePda.toBase58(),
    MARKETPLACE_PUBKEY: marketplacePda.toBase58(),
    PROVIDER_PUBKEY: providerPubkey.toBase58(),
    ADMIN_PUBKEY: providerPubkey.toBase58(),
    PRICE_LAMPORTS: PRICE_LAMPORTS.toString(),
    PROGRAM_ID: PROGRAM_ID.toBase58(),
    RPC_URL,
  };
  console.log("--- .env for demo server ---");
  Object.entries(config).forEach(([k, v]) => console.log(`${k}=${v}`));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
