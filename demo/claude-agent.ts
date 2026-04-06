/**
 * Autonomous AI agent that discovers and pays for API services via AgentPay x402.
 *
 * Supports any OpenAI-compatible LLM provider:
 *   GROQ_API_KEY       → Groq (free, fast) — llama-3.3-70b-versatile
 *   OPENAI_API_KEY     → OpenAI            — gpt-4o-mini
 *   ANTHROPIC_API_KEY  → via openai compat — (use GROQ or OPENAI instead)
 *   LLM_BASE_URL +
 *   LLM_API_KEY +
 *   LLM_MODEL          → any OpenAI-compatible endpoint
 *
 * Flow:
 *   1. Fetch all live services from the Solana devnet marketplace
 *   2. Pass service list + user query to the LLM
 *   3. LLM calls fetch_api_service() tools — X402Client pays automatically
 *   4. LLM synthesizes a natural-language answer from the paid data
 *
 * Prerequisites:
 *   - One of the API key env vars above
 *   - Solana devnet wallet at ~/.config/solana/id.json with SOL balance
 *   - Demo server running: npm run demo:server
 *
 * Usage:
 *   GROQ_API_KEY=gsk_... npm run demo:claude
 *   GROQ_API_KEY=gsk_... npm run demo:claude -- "What is the market sentiment?"
 *   OPENAI_API_KEY=sk-... npm run demo:claude
 */
import OpenAI from "openai";
import { Connection, Keypair, PublicKey, Transaction } from "@solana/web3.js";
import { X402Client, type Wallet } from "../sdk/src/index";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";

const PROGRAM_ID = new PublicKey("5g9CxSn7N2iVJg6971vjMZBYR3KXwSVFuQe9P37JKSQy");
const RPC_URL = process.env.RPC_URL ?? "https://api.devnet.solana.com";

// ---------------------------------------------------------------------------
// Provider selection
// ---------------------------------------------------------------------------

function buildClient(): { client: OpenAI; model: string; providerName: string } {
  if (process.env.GROQ_API_KEY) {
    return {
      client: new OpenAI({
        apiKey: process.env.GROQ_API_KEY,
        baseURL: "https://api.groq.com/openai/v1",
      }),
      model: process.env.LLM_MODEL ?? "llama-3.3-70b-versatile",
      providerName: "Groq",
    };
  }
  if (process.env.OPENAI_API_KEY) {
    return {
      client: new OpenAI({ apiKey: process.env.OPENAI_API_KEY }),
      model: process.env.LLM_MODEL ?? "gpt-4o-mini",
      providerName: "OpenAI",
    };
  }
  if (process.env.LLM_API_KEY && process.env.LLM_BASE_URL) {
    return {
      client: new OpenAI({
        apiKey: process.env.LLM_API_KEY,
        baseURL: process.env.LLM_BASE_URL,
      }),
      model: process.env.LLM_MODEL ?? "default",
      providerName: process.env.LLM_BASE_URL,
    };
  }
  throw new Error(
    "No LLM API key found.\n" +
    "Set one of: GROQ_API_KEY, OPENAI_API_KEY, or LLM_API_KEY+LLM_BASE_URL+LLM_MODEL\n\n" +
    "Groq is free: https://console.groq.com"
  );
}

// ---------------------------------------------------------------------------
// Marketplace discovery
// ---------------------------------------------------------------------------

interface ServiceInfo {
  pubkey: string;
  name: string;
  endpoint: string;
  priceLamports: number;
  callsServed: number;
}

function decodeService(pubkey: PublicKey, data: Buffer): ServiceInfo | null {
  try {
    let offset = 8; // skip discriminator
    offset += 32;   // skip provider pubkey

    const nameLen = data.readUInt32LE(offset); offset += 4;
    const name = data.slice(offset, offset + nameLen).toString("utf8"); offset += nameLen;

    const epLen = data.readUInt32LE(offset); offset += 4;
    const endpoint = data.slice(offset, offset + epLen).toString("utf8"); offset += epLen;

    const descLen = data.readUInt32LE(offset); offset += 4;
    offset += descLen;

    const priceLamports = Number(data.readBigUInt64LE(offset)); offset += 8;
    const callsServed = Number(data.readBigUInt64LE(offset)); offset += 8;
    const active = data[offset] === 1;

    if (!active) return null;
    return { pubkey: pubkey.toBase58(), name, endpoint, priceLamports, callsServed };
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
// Agentic loop
// ---------------------------------------------------------------------------

async function main() {
  const query = process.argv.slice(2).join(" ") ||
    "Give me a full market report: current crypto prices, market sentiment, and Solana network health.";

  console.log("\n╔══════════════════════════════════════════════════════════════╗");
  console.log("║          AgentPay — Autonomous x402 Payment Agent            ║");
  console.log("╚══════════════════════════════════════════════════════════════╝\n");

  const { client, model, providerName } = buildClient();
  console.log(`Provider: ${providerName}  |  Model: ${model}`);
  console.log(`Query:    "${query}"\n`);

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

  console.log("Discovering marketplace services from Solana devnet…");
  const services = await fetchMarketplaceServices(connection);
  console.log(`Found ${services.length} active service(s):\n`);
  for (const s of services) {
    console.log(`  • ${s.name}`);
    console.log(`    Endpoint: ${s.endpoint}`);
    console.log(`    Price:    ${s.priceLamports} lamports  |  Calls served: ${s.callsServed}`);
  }

  const balanceBefore = await connection.getBalance(payer.publicKey);
  console.log(`\nAgent wallet: ${payer.publicKey.toBase58()}`);
  console.log(`Balance:      ${(balanceBefore / 1e9).toFixed(6)} SOL\n`);
  console.log("─".repeat(64));
  console.log(`Handing off to ${providerName}…\n`);

  const tools: OpenAI.Chat.ChatCompletionTool[] = [
    {
      type: "function",
      function: {
        name: "fetch_api_service",
        description:
          "Fetch data from a marketplace API service. Payment is handled automatically " +
          "via Solana x402 — if the endpoint returns 402, the agent pays on-chain and retries.",
        parameters: {
          type: "object",
          properties: {
            endpoint: { type: "string", description: "The full HTTP endpoint URL." },
            service_name: { type: "string", description: "Human-readable service name (for logging)." },
          },
          required: ["endpoint", "service_name"],
        },
      },
    },
  ];

  const systemPrompt =
    `You are an autonomous AI agent with access to the AgentPay marketplace — ` +
    `a Solana-based pay-per-call API marketplace. Use fetch_api_service to call services. ` +
    `Payment in SOL is deducted automatically from your wallet for each call.\n\n` +
    `Available services:\n` +
    services.map((s) =>
      `- ${s.name}\n  Endpoint: ${s.endpoint}\n  Price: ${s.priceLamports} lamports`
    ).join("\n") +
    `\n\nFetch the relevant services, then give a clear, well-structured answer.`;

  const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
    { role: "system", content: systemPrompt },
    { role: "user", content: query },
  ];

  let totalLamportsPaid = 0;
  let iterationsLeft = 10;

  while (iterationsLeft-- > 0) {
    const response = await client.chat.completions.create({
      model,
      messages,
      tools,
      tool_choice: "auto",
    });

    const msg = response.choices[0].message;
    messages.push(msg);

    // Print any text content
    if (msg.content) {
      process.stdout.write(msg.content);
    }

    const finishReason = response.choices[0].finish_reason;
    if (finishReason === "stop" || !msg.tool_calls || msg.tool_calls.length === 0) {
      console.log("\n");
      break;
    }

    // Process tool calls
    for (const toolCall of msg.tool_calls) {
      if (toolCall.type !== "function") continue;
      const args = JSON.parse(toolCall.function.arguments) as { endpoint: string; service_name: string };
      console.log(`\n[x402] Fetching: ${args.service_name}`);
      console.log(`       URL: ${args.endpoint}`);

      let resultContent: string;
      try {
        const res = await x402Client.fetch(args.endpoint);
        const data = await res.json();

        if (res.ok) {
          console.log(`[x402] ✓ Payment confirmed — data received`);
          const svc = services.find((s) => s.endpoint === args.endpoint);
          if (svc) totalLamportsPaid += svc.priceLamports;
          resultContent = JSON.stringify(data, null, 2);
        } else {
          resultContent = `Error ${res.status}: ${JSON.stringify(data)}`;
        }
      } catch (err: unknown) {
        const errMsg = err instanceof Error ? err.message : String(err);
        console.error(`[x402] ✗ Error: ${errMsg}`);
        resultContent = `Failed to fetch: ${errMsg}`;
      }

      messages.push({
        role: "tool",
        tool_call_id: toolCall.id,
        content: resultContent,
      });
    }
  }

  console.log("─".repeat(64));
  const balanceAfter = await connection.getBalance(payer.publicKey);
  const totalSpent = balanceBefore - balanceAfter;
  console.log(`API payments:    ${totalLamportsPaid} lamports (${(totalLamportsPaid / 1e9).toFixed(6)} SOL)`);
  console.log(`Total SOL spent: ${(totalSpent / 1e9).toFixed(9)} SOL (incl. tx fees)`);
  console.log();
}

main().catch((err) => {
  console.error("\n✗ Fatal error:", err.message ?? err);
  process.exit(1);
});
