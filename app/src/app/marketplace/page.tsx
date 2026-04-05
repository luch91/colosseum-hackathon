import Link from "next/link";
import { getConnection, fetchAllServices } from "@/lib/program";
import type { ServiceState } from "@/lib/program";

// Revalidate every 30 seconds for live data without full SSR cost
export const revalidate = 30;

function lamportsToSol(lamports: number): string {
  return (lamports / 1_000_000_000).toFixed(6);
}

function ServiceCard({ service }: { service: ServiceState }) {
  return (
    <div style={{
      background: "var(--surface)",
      border: "1px solid var(--border)",
      borderRadius: 12,
      padding: 24,
      display: "flex",
      flexDirection: "column",
      gap: 12,
    }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div>
          <h3 style={{ fontWeight: 600, fontSize: 18, marginBottom: 4 }}>{service.name}</h3>
          <p style={{ fontSize: 13, color: "var(--muted)", wordBreak: "break-all" }}>
            {service.endpoint}
          </p>
        </div>
        <span style={{
          padding: "4px 10px",
          background: "rgba(20,241,149,0.1)",
          color: "var(--green)",
          borderRadius: 20,
          fontSize: 12,
          fontWeight: 600,
          whiteSpace: "nowrap",
          marginLeft: 12,
        }}>
          Active
        </span>
      </div>

      <p style={{ fontSize: 14, color: "var(--muted)" }}>{service.description}</p>

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 8 }}>
        <div>
          <span style={{ fontSize: 20, fontWeight: 700, color: "var(--accent)" }}>
            {lamportsToSol(service.priceLamports)} SOL
          </span>
          <span style={{ fontSize: 13, color: "var(--muted)", marginLeft: 6 }}>per call</span>
        </div>
        <span style={{ fontSize: 13, color: "var(--muted)" }}>
          {service.callsServed.toLocaleString()} calls served
        </span>
      </div>

      <div style={{ fontSize: 11, color: "var(--muted)", borderTop: "1px solid var(--border)", paddingTop: 12 }}>
        Provider: <code>{service.provider.slice(0, 8)}...{service.provider.slice(-6)}</code>
      </div>
    </div>
  );
}

export default async function MarketplacePage() {
  let services: ServiceState[] = [];
  let error: string | null = null;

  try {
    const connection = getConnection();
    services = await fetchAllServices(connection);
  } catch (e) {
    error = "Could not load services. Check RPC connection.";
  }

  return (
    <main style={{ maxWidth: 1100, margin: "0 auto", padding: "60px 24px" }}>
      {/* Nav */}
      <nav style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 60 }}>
        <Link href="/" style={{ fontWeight: 700, fontSize: 20, color: "var(--accent)" }}>AgentPay</Link>
        <div style={{ display: "flex", gap: 24, fontSize: 14 }}>
          <span style={{ color: "var(--text)", fontWeight: 600 }}>Marketplace</span>
          <a href="https://github.com/luch91/colosseum-hackathon" target="_blank" rel="noreferrer">GitHub</a>
        </div>
      </nav>

      {/* Header */}
      <div style={{ marginBottom: 40 }}>
        <h1 style={{ fontSize: 36, fontWeight: 800, marginBottom: 12 }}>Service Marketplace</h1>
        <p style={{ color: "var(--muted)", fontSize: 16 }}>
          Registered APIs available for autonomous x402 payment. Any agent can pay and consume these services instantly.
        </p>
      </div>

      {/* SDK snippet */}
      <div style={{
        background: "var(--surface)",
        border: "1px solid var(--border)",
        borderRadius: 12,
        padding: 20,
        marginBottom: 40,
        fontSize: 13,
        lineHeight: 1.7,
      }}>
        <span style={{ color: "var(--muted)" }}>// Pay for any service with 1 line:</span>
        <br />
        <code>
          {"const res = await client.fetch("}
          <span style={{ color: "var(--green)" }}>&quot;{services[0]?.endpoint ?? "https://api.agentpay.xyz/service"}&quot;</span>
          {");"}
        </code>
      </div>

      {/* Services grid */}
      {error && (
        <div style={{ color: "#f87171", padding: 16, border: "1px solid #7f1d1d", borderRadius: 8, marginBottom: 32 }}>
          {error}
        </div>
      )}

      {!error && services.length === 0 && (
        <div style={{ textAlign: "center", padding: "80px 0", color: "var(--muted)" }}>
          <p style={{ fontSize: 18, marginBottom: 8 }}>No services registered yet.</p>
          <p style={{ fontSize: 14 }}>Be the first — register your API using the SDK.</p>
        </div>
      )}

      <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fill, minmax(340px, 1fr))",
        gap: 24,
      }}>
        {services.map((service) => (
          <ServiceCard key={service.pubkey} service={service} />
        ))}
      </div>

      {/* Register CTA */}
      <div style={{
        marginTop: 60,
        padding: 40,
        background: "rgba(153,69,255,0.08)",
        border: "1px solid rgba(153,69,255,0.3)",
        borderRadius: 16,
        textAlign: "center",
      }}>
        <h2 style={{ fontSize: 24, fontWeight: 700, marginBottom: 12 }}>Register your API</h2>
        <p style={{ color: "var(--muted)", marginBottom: 24 }}>
          Any HTTP endpoint can be monetized for agent consumption in minutes.
        </p>
        <pre style={{ fontSize: 12, textAlign: "left", display: "inline-block", background: "var(--surface)", padding: 16, borderRadius: 8 }}>{`import { x402NextMiddleware } from "@agentpay/sdk";

export const middleware = x402NextMiddleware({
  servicePubkey: "YOUR_SERVICE_PDA",
  priceLamports: 1_000_000, // 0.001 SOL
  providerPubkey: "YOUR_WALLET",
  ...
});`}</pre>
      </div>
    </main>
  );
}
