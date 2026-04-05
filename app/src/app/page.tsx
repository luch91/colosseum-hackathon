import Link from "next/link";

export default function Home() {
  return (
    <main style={{ maxWidth: 960, margin: "0 auto", padding: "80px 24px" }}>
      {/* Header */}
      <nav style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 80 }}>
        <span style={{ fontWeight: 700, fontSize: 20, color: "var(--accent)" }}>AgentPay</span>
        <div style={{ display: "flex", gap: 24, fontSize: 14 }}>
          <Link href="/marketplace">Marketplace</Link>
          <a href="https://github.com/luch91/colosseum-hackathon" target="_blank" rel="noreferrer">GitHub</a>
        </div>
      </nav>

      {/* Hero */}
      <section style={{ textAlign: "center", marginBottom: 100 }}>
        <div style={{
          display: "inline-block",
          padding: "4px 12px",
          background: "rgba(153,69,255,0.15)",
          border: "1px solid rgba(153,69,255,0.4)",
          borderRadius: 20,
          fontSize: 12,
          color: "var(--accent)",
          marginBottom: 24,
          letterSpacing: 1,
          textTransform: "uppercase",
        }}>
          Built for Frontier Hackathon 2026
        </div>

        <h1 style={{ fontSize: "clamp(36px, 6vw, 64px)", fontWeight: 800, lineHeight: 1.1, marginBottom: 24 }}>
          Agents pay agents.{" "}
          <span style={{ color: "var(--accent)" }}>Instantly.</span>
        </h1>

        <p style={{ fontSize: 20, color: "var(--muted)", maxWidth: 600, margin: "0 auto 40px" }}>
          x402 machine payments on Solana. Any AI agent with a wallet can pay
          for any registered API service autonomously — no subscriptions,
          no approvals, settled in under a second.
        </p>

        <div style={{ display: "flex", gap: 16, justifyContent: "center", flexWrap: "wrap" }}>
          <Link href="/marketplace" style={{
            background: "var(--accent)",
            color: "#fff",
            padding: "14px 28px",
            borderRadius: 8,
            fontWeight: 600,
            fontSize: 16,
          }}>
            Browse Services
          </Link>
          <a href="https://github.com/luch91/colosseum-hackathon" target="_blank" rel="noreferrer" style={{
            border: "1px solid var(--border)",
            color: "var(--text)",
            padding: "14px 28px",
            borderRadius: 8,
            fontWeight: 600,
            fontSize: 16,
          }}>
            View on GitHub
          </a>
        </div>
      </section>

      {/* How it works */}
      <section style={{ marginBottom: 100 }}>
        <h2 style={{ fontSize: 28, fontWeight: 700, marginBottom: 40, textAlign: "center" }}>How x402 works</h2>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 24 }}>
          {[
            { step: "1", title: "Agent requests", body: "Agent calls any AgentPay-registered API endpoint normally." },
            { step: "2", title: "Server returns 402", body: "Server responds with payment requirements: service, price, provider address." },
            { step: "3", title: "Agent pays on-chain", body: "Agent SDK sends a Solana transaction — confirmed in ~400ms for fractions of a cent." },
            { step: "4", title: "Agent retries with proof", body: "Request retried with X-Payment-Proof header. Server verifies and responds." },
          ].map(({ step, title, body }) => (
            <div key={step} style={{
              background: "var(--surface)",
              border: "1px solid var(--border)",
              borderRadius: 12,
              padding: 24,
            }}>
              <div style={{
                width: 32, height: 32, borderRadius: "50%",
                background: "rgba(153,69,255,0.2)",
                color: "var(--accent)",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontWeight: 700, fontSize: 14, marginBottom: 16,
              }}>{step}</div>
              <h3 style={{ fontWeight: 600, marginBottom: 8 }}>{title}</h3>
              <p style={{ fontSize: 14, color: "var(--muted)" }}>{body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* SDK snippet */}
      <section style={{ marginBottom: 100 }}>
        <h2 style={{ fontSize: 28, fontWeight: 700, marginBottom: 40, textAlign: "center" }}>2 lines to integrate</h2>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24 }}>
          <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12, padding: 24 }}>
            <p style={{ fontSize: 12, color: "var(--accent)", marginBottom: 16, fontWeight: 600 }}>PAYING AGENT</p>
            <pre style={{ fontSize: 13, lineHeight: 1.7, color: "var(--text)", overflowX: "auto" }}>{`import { X402Client } from "@agentpay/sdk";

const client = new X402Client(
  connection, wallet, PROGRAM_ID
);

// Automatically handles 402
const res = await client.fetch(
  "https://api.example.com/data"
);`}</pre>
          </div>
          <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12, padding: 24 }}>
            <p style={{ fontSize: 12, color: "var(--green)", marginBottom: 16, fontWeight: 600 }}>SERVICE PROVIDER</p>
            <pre style={{ fontSize: 13, lineHeight: 1.7, color: "var(--text)", overflowX: "auto" }}>{`import { x402NextMiddleware } from "@agentpay/sdk";

// Wrap any Next.js route
export const middleware = x402NextMiddleware({
  servicePubkey: SERVICE_PDA,
  priceLamports: 1_000_000,
  ...config,
});`}</pre>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer style={{ textAlign: "center", color: "var(--muted)", fontSize: 14, borderTop: "1px solid var(--border)", paddingTop: 40 }}>
        Built on Solana · x402 protocol · Open Wallet Standard ·{" "}
        <a href="https://github.com/luch91/colosseum-hackathon" target="_blank" rel="noreferrer">Open source</a>
      </footer>
    </main>
  );
}
