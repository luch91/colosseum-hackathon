/**
 * Claude-powered autonomous agent that discovers and pays for API services
 * via the AgentPay x402 marketplace.
 *
 * Flow:
 *   1. Fetch all live services from the Solana devnet marketplace
 *   2. Pass service list + user query to Claude
 *   3. Claude calls fetch_api_service() tools — X402Client pays automatically
 *   4. Claude synthesizes a natural-language answer from the paid data
 *
 * Prerequisites:
 *   - ANTHROPIC_API_KEY set in environment
 *   - Solana devnet wallet at ~/.config/solana/id.json with SOL balance
 *   - Demo server running: npm run demo:server
 *
 * Usage:
 *   npm run demo:claude
 *   npm run demo:claude -- "What's the current market sentiment for crypto?"
 *   npm run demo:claude -- "Give me a full market report: prices, sentiment, and Solana stats"
 */
import Anthropic from "@anthropic-ai/sdk";
import { Connection, Keypair, PublicKey, Transaction } from "@solana/web3.js";
import { X402Client, type Wallet } from "../sdk/src/index";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";

const PROGRAM_ID = new PublicKey("5g9CxSn7N2iVJg6971vjMZBYR3KXwSVFuQe9P37JKSQy");
const MARKETPLACE_PDA = new PublicKey("5wTnczmfP64ZjoTz1KmCuoQJawNnLtWCrTgGnqf953b6");
const RPC_URL = process.env.RPC_URL ?? "https://api.devnet.solana.com";
const SERVICE_SEED = Buffer.from("service");

// ---------------------------------------------------------------------------
// Marketplace discovery (mirrors app/src/lib/program.ts without Next.js deps)
// ---------------------------------------------------------------------------

interface ServiceInfo {
  pubkey: string;
  provider: string;
  name: string;
  endpoint: string;
  priceLamports: number;
  callsServed: number;
}

function decodeService(pubkey: PublicKey, data: Buffer): ServiceInfo | null {
  try {
    let offset = 8; // skip discriminator
    const provider = new PublicKey(data.slice(offset, offset + 32)).toBase58();
    offset += 32;

    const nameLen = data.readUInt32LE(offset); offset += 4;
    const name = data.slice(offset, offset + nameLen).toString("utf8"); offset += nameLen;

    const epLen = data.readUInt32LE(offset); offset += 4;
    const endpoint = data.slice(offset, offset + epLen).toString("utf8"); offset += epLen;

    const descLen = data.readUInt32LE(offset); offset += 4;
    offset += descLen; // skip description for now

    const priceLamports = Number(data.readBigUInt64LE(offset)); offset += 8;
    const callsServed = Number(data.readBigUInt64LE(offset)); offset += 8;
    const active = data[offset] === 1;

    if (!active) return null;
    return { pubkey: pubkey.toBase58(), provider, name, endpoint, priceLamports, callsServed };
  } catch {
    return null;
  }
}

async function fetchMarketplaceServices(connection: Connection): Promise<ServiceInfo[]> {
  const SERVICE_DISCRIMINATOR = Buffer.from([0x90, 0x3e, 0x4c, 0x81, 0xa7, 0x24, 0x97, 0xfa]);

  const accounts = await connection.getProgramAccounts(PROGRAM_ID, {
    commitment: "confirmed",
    filters: [{ memcmp: { offset: 0, bytes: SERVICE_DISCRIMINATOR.toString("base64"), encoding: "base64" } }],
  });

  return accounts
    .map(({ pubkey, account }) => decodeService(pubkey, account.data as Buffer))
    .filter((s): s is ServiceInfo => s !== null);
}

// ---------------------------------------------------------------------------
// Main agentic loop
// ---------------------------------------------------------------------------

async function main() {
  const query = process.argv.slice(2).join(" ") ||
    "Give me a full market report: current crypto prices, market sentiment, and Solana network health.";

  console.log("\n╔══════════════════════════════════════════════════════════════╗");
  console.log("║          AgentPay — Claude Autonomous Payment Agent          ║");
  console.log("╚══════════════════════════════════════════════════════════════╝\n");
  console.log(`Query: "${query}"\n`);

  // Load wallet
  const keypairPath = path.join(os.homedir(), ".config", "solana", "id.json");
  const payer = Keypair.fromSecretKey(
    Uint8Array.from(JSON.parse(fs.readFileSync(keypairPath, "utf-8")))
  );
  const wallet: Wallet = {
    publicKey: payer.publicKey,
    signTransaction: async (tx: Transaction) => { tx.sign(payer); return tx; },
  };

  const connection = new Connection(RPC_URL, "confirmed");
  const x402Client = new X402Client(connection, wallet, PROGRAM_ID);
  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  // Discover services
  console.log("Discovering marketplace services from Solana devnet…");
  const services = await fetchMarketplaceServices(connection);
  console.log(`Found ${services.length} active service(s):\n`);
  for (const s of services) {
    console.log(`  • ${s.name}`);
    console.log(`    Endpoint: ${s.endpoint}`);
    console.log(`    Price:    ${s.priceLamports} lamports (${(s.priceLamports / 1e9).toFixed(6)} SOL)`);
    console.log(`    Calls:    ${s.callsServed.toLocaleString()}`);
    console.log();
  }

  const balanceBefore = await connection.getBalance(payer.publicKey);
  console.log(`Agent wallet: ${payer.publicKey.toBase58()}`);
  console.log(`Balance:      ${(balanceBefore / 1e9).toFixed(6)} SOL\n`);
  console.log("─".repeat(64));
  console.log("Handing off to Claude…\n");

  // Tool definition — Claude calls this to fetch a service (payment is automatic)
  const tools: Anthropic.Tool[] = [
    {
      name: "fetch_api_service",
      description:
        "Fetch data from a marketplace API service. Payment is handled automatically " +
        "via Solana x402 — if the endpoint returns 402, the agent pays on-chain and retries. " +
        "Use this to retrieve real-time data from any listed service.",
      input_schema: {
        type: "object" as const,
        properties: {
          endpoint: {
            type: "string",
            description: "The full HTTP endpoint URL from the marketplace listing.",
          },
          service_name: {
            type: "string",
            description: "Human-readable name of the service (for logging).",
          },
        },
        required: ["endpoint", "service_name"],
      },
    },
  ];

  // System prompt tells Claude about the marketplace
  const systemPrompt =
    `You are an autonomous AI agent with access to the AgentPay marketplace — ` +
    `a Solana-based pay-per-call API marketplace. You can call any listed service ` +
    `using the fetch_api_service tool. Payment (in SOL) is deducted automatically ` +
    `from your agent wallet for each call.\n\n` +
    `Available services:\n` +
    services.map((s) =>
      `- ${s.name}\n  Endpoint: ${s.endpoint}\n  Price: ${s.priceLamports} lamports`
    ).join("\n") +
    `\n\nAnswer the user's query by fetching relevant services. ` +
    `After collecting data, provide a clear, well-structured response.`;

  // Agentic loop
  const messages: Anthropic.MessageParam[] = [
    { role: "user", content: query },
  ];

  let totalLamportsPaid = 0;
  let iterationsLeft = 10; // safety limit

  while (iterationsLeft-- > 0) {
    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 4096,
      system: systemPrompt,
      tools,
      messages,
    });

    // Collect text output
    const textBlocks = response.content.filter((b): b is Anthropic.TextBlock => b.type === "text");
    if (textBlocks.length > 0) {
      for (const block of textBlocks) {
        process.stdout.write(block.text);
      }
    }

    if (response.stop_reason === "end_turn") {
      console.log("\n");
      break;
    }

    if (response.stop_reason !== "tool_use") {
      break;
    }

    // Process tool calls
    const toolUseBlocks = response.content.filter(
      (b): b is Anthropic.ToolUseBlock => b.type === "tool_use"
    );

    messages.push({ role: "assistant", content: response.content });

    const toolResults: Anthropic.ToolResultBlockParam[] = [];

    for (const toolCall of toolUseBlocks) {
      const input = toolCall.input as { endpoint: string; service_name: string };
      console.log(`\n[x402] Fetching: ${input.service_name}`);
      console.log(`       URL: ${input.endpoint}`);

      try {
        const res = await x402Client.fetch(input.endpoint);
        const data = await res.json();

        if (res.ok) {
          console.log(`[x402] ✓ Payment confirmed — data received`);
          // Approximate lamports paid (read from service list)
          const svc = services.find((s) => s.endpoint === input.endpoint);
          if (svc) totalLamportsPaid += svc.priceLamports;

          toolResults.push({
            type: "tool_result",
            tool_use_id: toolCall.id,
            content: JSON.stringify(data, null, 2),
          });
        } else {
          toolResults.push({
            type: "tool_result",
            tool_use_id: toolCall.id,
            content: `Error ${res.status}: ${JSON.stringify(data)}`,
            is_error: true,
          });
        }
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error(`[x402] ✗ Error: ${msg}`);
        toolResults.push({
          type: "tool_result",
          tool_use_id: toolCall.id,
          content: `Failed to fetch: ${msg}`,
          is_error: true,
        });
      }
    }

    messages.push({ role: "user", content: toolResults });
  }

  // Summary
  console.log("─".repeat(64));
  const balanceAfter = await connection.getBalance(payer.publicKey);
  const totalSpent = balanceBefore - balanceAfter;
  console.log(`Total SOL spent: ${(totalSpent / 1e9).toFixed(9)} (${totalSpent} lamports)`);
  console.log(`API calls paid:  ${totalLamportsPaid} lamports across ${services.length > 0 ? "devnet services" : "no services"}`);
  console.log();
}

main().catch((err) => {
  console.error("\n✗ Fatal error:", err.message ?? err);
  process.exit(1);
});
