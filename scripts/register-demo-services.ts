/**
 * Register 2 additional demo services on the AgentPay marketplace.
 *
 * Services registered:
 *   1. AgentPay Demo: Market Sentiment  — /api/sentiment  (5,000 lamports)
 *   2. AgentPay Demo: Solana Stats      — /api/stats      (8,000 lamports)
 *
 * Generates fresh keypairs saved to keys/sentiment-keypair.json and
 * keys/stats-keypair.json, funds them from your main wallet, then registers
 * each service on-chain.
 *
 * Also writes keys/service-configs.json consumed by demo/service-server.ts.
 *
 * Run: npm run register-demo-services
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
const MARKETPLACE_PDA = new PublicKey("5wTnczmfP64ZjoTz1KmCuoQJawNnLtWCrTgGnqf953b6");
const RPC_URL = process.env.RPC_URL ?? "https://api.devnet.solana.com";
const SERVICE_SEED = Buffer.from("service");
const KEYS_DIR = path.join(__dirname, "..", "keys");

// Service 2 and 3 definitions
const NEW_SERVICES = [
  {
    file: "sentiment-keypair.json",
    name: "AgentPay Demo: Market Sentiment",
    endpoint: "http://localhost:3001/api/sentiment",
    description: "Crypto market sentiment: fear/greed index, whale activity, trend signals.",
    priceLamports: BigInt(5_000),
    routePath: "/api/sentiment",
  },
  {
    file: "stats-keypair.json",
    name: "AgentPay Demo: Solana Stats",
    endpoint: "http://localhost:3001/api/stats",
    description: "Live Solana network stats: TPS, slot height, validator count, stake.",
    priceLamports: BigInt(8_000),
    routePath: "/api/stats",
  },
];

function encodeString(str: string): Buffer {
  const bytes = Buffer.from(str, "utf-8");
  const len = Buffer.alloc(4);
  len.writeUInt32LE(bytes.length, 0);
  return Buffer.concat([len, bytes]);
}

async function loadOrGenerate(filePath: string): Promise<Keypair> {
  if (fs.existsSync(filePath)) {
    const raw = JSON.parse(fs.readFileSync(filePath, "utf-8"));
    return Keypair.fromSecretKey(Uint8Array.from(raw));
  }
  const kp = Keypair.generate();
  fs.writeFileSync(filePath, JSON.stringify(Array.from(kp.secretKey)));
  console.log(`  Generated new keypair → ${filePath}`);
  return kp;
}

async function registerService(
  connection: Connection,
  funder: Keypair,
  provider: Keypair,
  name: string,
  endpoint: string,
  description: string,
  priceLamports: bigint
): Promise<PublicKey> {
  const [servicePda] = PublicKey.findProgramAddressSync(
    [SERVICE_SEED, provider.publicKey.toBuffer()],
    PROGRAM_ID
  );

  const existing = await connection.getAccountInfo(servicePda);
  if (existing) {
    console.log(`  Already registered: ${servicePda.toBase58()}`);
    return servicePda;
  }

  // Fund provider if balance too low
  const balance = await connection.getBalance(provider.publicKey);
  if (balance < 50_000_000) {
    console.log(`  Funding ${provider.publicKey.toBase58().slice(0, 12)}… with 0.05 SOL`);
    const fundTx = new Transaction().add(
      SystemProgram.transfer({
        fromPubkey: funder.publicKey,
        toPubkey: provider.publicKey,
        lamports: 50_000_000,
      })
    );
    await sendAndConfirmTransaction(connection, fundTx, [funder], { commitment: "confirmed" });
  }

  const discriminator = Buffer.from([0x0b, 0x85, 0x9e, 0xe8, 0xc1, 0x13, 0xe5, 0x49]);
  const priceData = Buffer.alloc(8);
  priceData.writeBigUInt64LE(priceLamports, 0);

  const ix = new TransactionInstruction({
    keys: [
      { pubkey: servicePda, isSigner: false, isWritable: true },
      { pubkey: MARKETPLACE_PDA, isSigner: false, isWritable: true },
      { pubkey: provider.publicKey, isSigner: true, isWritable: true },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ],
    programId: PROGRAM_ID,
    data: Buffer.concat([
      discriminator,
      encodeString(name),
      encodeString(endpoint),
      encodeString(description),
      priceData,
    ]),
  });

  const sig = await sendAndConfirmTransaction(
    connection,
    new Transaction().add(ix),
    [provider],
    { commitment: "confirmed" }
  );

  console.log(`  ✓ Registered — sig: ${sig.slice(0, 24)}…`);
  console.log(`  Service PDA: ${servicePda.toBase58()}`);
  return servicePda;
}

async function main() {
  if (!fs.existsSync(KEYS_DIR)) {
    fs.mkdirSync(KEYS_DIR, { recursive: true });
  }

  const connection = new Connection(RPC_URL, "confirmed");
  const keypairPath = path.join(os.homedir(), ".config", "solana", "id.json");
  const funder = Keypair.fromSecretKey(
    Uint8Array.from(JSON.parse(fs.readFileSync(keypairPath, "utf-8")))
  );
  console.log("Funder:", funder.publicKey.toBase58());
  const bal = await connection.getBalance(funder.publicKey);
  console.log("Balance:", (bal / 1e9).toFixed(4), "SOL\n");

  const registeredServices: object[] = [
    // Service 1 already exists — include it in the config
    {
      name: "AgentPay Demo: Crypto Prices",
      routePath: "/api/prices",
      servicePubkey: "E4AD5Zr6QDfTH3qn5zwDkducUQREryWqFbFusBSwjF2o",
      marketplacePubkey: MARKETPLACE_PDA.toBase58(),
      providerPubkey: funder.publicKey.toBase58(),
      adminPubkey: funder.publicKey.toBase58(),
      priceLamports: 10_000,
    },
  ];

  for (const svc of NEW_SERVICES) {
    const keypairFile = path.join(KEYS_DIR, svc.file);
    console.log(`Registering: ${svc.name}`);
    const provider = await loadOrGenerate(keypairFile);

    const servicePda = await registerService(
      connection,
      funder,
      provider,
      svc.name,
      svc.endpoint,
      svc.description,
      svc.priceLamports
    );

    registeredServices.push({
      name: svc.name,
      routePath: svc.routePath,
      servicePubkey: servicePda.toBase58(),
      marketplacePubkey: MARKETPLACE_PDA.toBase58(),
      providerPubkey: provider.publicKey.toBase58(),
      adminPubkey: funder.publicKey.toBase58(),
      priceLamports: Number(svc.priceLamports),
    });

    console.log();
  }

  const configFile = path.join(KEYS_DIR, "service-configs.json");
  fs.writeFileSync(configFile, JSON.stringify(registeredServices, null, 2));
  console.log(`✓ Config written to ${configFile}`);
  console.log("\nRun the multi-service demo server with:");
  console.log("  npm run demo:server\n");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
