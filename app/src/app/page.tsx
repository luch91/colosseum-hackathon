import Link from "next/link";
import { getConnection, fetchAllServices } from "@/lib/program";

export const revalidate = 60;

async function getStats() {
  try {
    const services = await fetchAllServices(getConnection());
    const totalVolume = services.reduce((acc, s) => acc + s.callsServed * s.priceLamports, 0);
    return { services: services.length, volume: totalVolume };
  } catch {
    return { services: 0, volume: 0 };
  }
}

export default async function Home() {
  const stats = await getStats();

  return (
    <main style={{ maxWidth: 960, margin: "0 auto", padding: "80px 24px" }}>
      {/* Hero */}
      <section style={{ textAlign: "center", marginBottom: 80 }}>
        <div style={{
          display: "inline-block", padding: "4px 14px",
          background: "rgba(153,69,255,0.15)", border: "1px solid rgba(153,69,255,0.4)",
          borderRadius: 20, fontSize: 12, color: "var(--accent)",
          marginBottom: 24, letterSpacing: 1, textTransform: "uppercase" as const,
        }}>
          Built for Frontier Hackathon 2026
        </div>

        <h1 style={{ fontSize: "clamp(36px, 6vw, 64px)", fontWeight: 800, lineHeight: 1.1, marginBottom: 20 }}>
          Agents pay agents.{" "}
          <span style={{ color: "var(--accent)" }}>Instantly.</span>
        </h1>

        <p style={{ fontSize: 19, color: "var(--muted)", maxWidth: 580, margin: "0 auto 16px" }}>
          x402 machine payments on Solana. Any AI agent with a wallet pays for
          any registered API — no subscriptions, no approvals, settled in 400ms.
        </p>

        <p style={{ fontSize: 14, color: "var(--muted)", marginBottom: 36 }}>
          Program{" "}
          <a
            href="https://explorer.solana.com/address/5g9CxSn7N2iVJg6971vjMZBYR3KXwSVFuQe9P37JKSQy?cluster=devnet"
            target="_blank" rel="noreferrer"
            style={{ fontFamily: "monospace" }}
          >
            5g9Cx…SQy
          </a>{" "}
          live on devnet
        </p>

        <div style={{ display: "flex", gap: 16, justifyContent: "center", flexWrap: "wrap" as const }}>
          <Link href="/marketplace" style={{
            background: "var(--accent)", color: "#fff",
            padding: "13px 28px", borderRadius: 8, fontWeight: 600, fontSize: 15,
          }}>Browse Services</Link>
          <Link href="/demo" style={{
            border: "1px solid var(--border)", color: "var(--text)",
            padding: "13px 28px", borderRadius: 8, fontWeight: 600, fontSize: 15,
          }}>Try Live Demo</Link>
        </div>
      </section>

      {/* Live stats */}
      <section style={{ display: "flex", gap: 24, justifyContent: "center", marginBottom: 80, flexWrap: "wrap" as const }}>
        {[
          { label: "Services registered", value: stats.services.toString() },
          { label: "Total calls served", value: "Live devnet" },
          { label: "Avg settlement", value: "< 400ms" },
          { label: "Fee", value: "1% (100 bps)" },
        ].map(({ label, value }) => (
          <div key={label} style={{
            flex: "1 1 160px", textAlign: "center",
            background: "var(--surface)", border: "1px solid var(--border)",
            borderRadius: 12, padding: "20px 24px",
          }}>
            <div style={{ fontSize: 26, fontWeight: 800, color: "var(--accent)", marginBottom: 4 }}>{value}</div>
            <div style={{ fontSize: 13, color: "var(--muted)" }}>{label}</div>
          </div>
        ))}
      </section>

      {/* How it works */}
      <section style={{ marginBottom: 80 }}>
        <h2 style={{ fontSize: 26, fontWeight: 700, marginBottom: 32, textAlign: "center" }}>How x402 works</h2>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 20 }}>
          {[
            { step: "1", title: "Agent requests", body: "Agent calls any AgentPay-registered endpoint normally." },
            { step: "2", title: "Server returns 402", body: "Server responds with payment requirements and on-chain service address." },
            { step: "3", title: "Agent pays on-chain", body: "SDK sends a Solana transaction — confirmed in ~400ms, costs fractions of a cent." },
            { step: "4", title: "Retry with proof", body: "Request retried with X-Payment-Proof header. Server verifies on-chain and responds." },
          ].map(({ step, title, body }) => (
            <div key={step} style={{
              background: "var(--surface)", border: "1px solid var(--border)",
              borderRadius: 12, padding: 24,
            }}>
              <div style={{
                width: 30, height: 30, borderRadius: "50%",
                background: "rgba(153,69,255,0.2)", color: "var(--accent)",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontWeight: 700, fontSize: 13, marginBottom: 14,
              }}>{step}</div>
              <h3 style={{ fontWeight: 600, marginBottom: 6, fontSize: 15 }}>{title}</h3>
              <p style={{ fontSize: 13, color: "var(--muted)", lineHeight: 1.6 }}>{body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* SDK code */}
      <section style={{ marginBottom: 80 }}>
        <h2 style={{ fontSize: 26, fontWeight: 700, marginBottom: 32, textAlign: "center" }}>2 lines to integrate</h2>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
          <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12, padding: 24 }}>
            <p style={{ fontSize: 11, color: "var(--accent)", marginBottom: 14, fontWeight: 700, letterSpacing: 1 }}>AI AGENT</p>
            <pre style={{ fontSize: 12, lineHeight: 1.8, color: "var(--text)", overflowX: "auto" as const }}>{`import { X402Client } from "@agentpay/sdk";

const client = new X402Client(
  connection, wallet, PROGRAM_ID
);

// Automatically handles 402 → pay → retry
const res = await client.fetch(
  "https://api.example.com/data"
);`}</pre>
          </div>
          <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12, padding: 24 }}>
            <p style={{ fontSize: 11, color: "var(--green)", marginBottom: 14, fontWeight: 700, letterSpacing: 1 }}>API PROVIDER</p>
            <pre style={{ fontSize: 12, lineHeight: 1.8, color: "var(--text)", overflowX: "auto" as const }}>{`import { x402NextMiddleware } from "@agentpay/sdk";

// Drop into any Next.js route
export const middleware = x402NextMiddleware({
  servicePubkey: YOUR_SERVICE_PDA,
  priceLamports: 10_000, // 0.00001 SOL
  providerPubkey: YOUR_WALLET,
  ...
});`}</pre>
          </div>
        </div>
      </section>

      <footer style={{
        textAlign: "center", color: "var(--muted)", fontSize: 13,
        borderTop: "1px solid var(--border)", paddingTop: 40,
      }}>
        AgentPay · Solana devnet · x402 protocol ·{" "}
        <a href="https://github.com/luch91/colosseum-hackathon" target="_blank" rel="noreferrer">Open source</a>
      </footer>
    </main>
  );
}
