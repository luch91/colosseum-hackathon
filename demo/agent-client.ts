/**
 * Demo AI agent that autonomously pays for API access via x402.
 *
 * Flow:
 *   1. Agent requests /api/prices
 *   2. Server returns 402 + X-Payment-Required header
 *   3. X402Client pays on-chain (pay_for_service tx)
 *   4. Agent retries with X-Payment-Proof header
 *   5. Server verifies proof, returns data
 *
 * Run: npm run demo:client
 */
import { Connection, Keypair, PublicKey, Transaction } from "@solana/web3.js";
import { X402Client, type Wallet } from "../sdk/src/index";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";

const PROGRAM_ID = new PublicKey("5g9CxSn7N2iVJg6971vjMZBYR3KXwSVFuQe9P37JKSQy");
const RPC_URL = process.env.RPC_URL ?? "https://api.devnet.solana.com";
const SERVICE_URL = process.env.SERVICE_URL ?? "http://localhost:3001/api/prices";

async function main() {
  const connection = new Connection(RPC_URL, "confirmed");

  const keypairPath = path.join(os.homedir(), ".config", "solana", "id.json");
  const payer = Keypair.fromSecretKey(
    Uint8Array.from(JSON.parse(fs.readFileSync(keypairPath, "utf-8")))
  );

  // Wrap Keypair in the Wallet interface expected by X402Client
  const wallet: Wallet = {
    publicKey: payer.publicKey,
    signTransaction: async (tx: Transaction) => {
      tx.sign(payer);
      return tx;
    },
  };

  console.log("Agent wallet:", payer.publicKey.toBase58());
  console.log("Service URL: ", SERVICE_URL);

  const balanceBefore = await connection.getBalance(payer.publicKey);
  console.log("Balance:     ", (balanceBefore / 1e9).toFixed(6), "SOL\n");

  const client = new X402Client(connection, wallet, PROGRAM_ID);

  console.log(`Fetching ${SERVICE_URL}...`);
  console.log("(will pay automatically if 402 received)\n");

  const response = await client.fetch(SERVICE_URL);

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Request failed (${response.status}): ${body}`);
  }

  const data = await response.json();

  console.log("✓ Payment successful! Response:");
  console.log(JSON.stringify(data, null, 2));

  const balanceAfter = await connection.getBalance(payer.publicKey);
  const spent = (balanceBefore - balanceAfter) / 1e9;
  console.log(`\nSOL spent: ${spent.toFixed(9)} (${balanceBefore - balanceAfter} lamports)`);
}

main().catch((err) => {
  console.error("\n✗ Error:", err.message ?? err);
  process.exit(1);
});
