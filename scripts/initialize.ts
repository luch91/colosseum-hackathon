/**
 * One-time admin script: initialize the AgentPay marketplace on-chain.
 * Run once per deployment. Safe to re-run — exits cleanly if already initialized.
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
const FEE_BPS = 100; // 1%

async function main() {
  const connection = new Connection(RPC_URL, "confirmed");

  const keypairPath = path.join(os.homedir(), ".config", "solana", "id.json");
  const admin = Keypair.fromSecretKey(
    Uint8Array.from(JSON.parse(fs.readFileSync(keypairPath, "utf-8")))
  );

  console.log("Admin:          ", admin.publicKey.toBase58());

  const [marketplacePda] = PublicKey.findProgramAddressSync(
    [MARKETPLACE_SEED],
    PROGRAM_ID
  );
  console.log("Marketplace PDA:", marketplacePda.toBase58());

  const existing = await connection.getAccountInfo(marketplacePda);
  if (existing) {
    console.log("\nMarketplace already initialized — nothing to do.");
    return;
  }

  // Discriminator = sha256("global:initialize")[0..8]
  const discriminator = Buffer.from([0xaf, 0xaf, 0x6d, 0x1f, 0x0d, 0x98, 0x9b, 0xed]);
  const feeBpsData = Buffer.alloc(2);
  feeBpsData.writeUInt16LE(FEE_BPS, 0);

  const ix = new TransactionInstruction({
    keys: [
      { pubkey: marketplacePda, isSigner: false, isWritable: true },
      { pubkey: admin.publicKey, isSigner: true, isWritable: true },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ],
    programId: PROGRAM_ID,
    data: Buffer.concat([discriminator, feeBpsData]),
  });

  const sig = await sendAndConfirmTransaction(
    connection,
    new Transaction().add(ix),
    [admin],
    { commitment: "confirmed" }
  );

  console.log("\n✓ Marketplace initialized!");
  console.log("Signature:", sig);
  console.log("Fee:      ", FEE_BPS, "bps (1%)");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
