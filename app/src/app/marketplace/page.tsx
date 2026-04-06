import Link from "next/link";
import { getConnection, fetchAllServices } from "@/lib/program";
import type { ServiceState } from "@/lib/program";

export const revalidate = 30;

function lamportsToSol(lamports: number): string {
  return (lamports / 1_000_000_000).toFixed(lamports < 10_000 ? 6 : 4);
}

function ServiceCard({ service }: { service: ServiceState }) {
  return (
    <div style={{
      background: "var(--surface)", border: "1px solid var(--border)",
      borderRadius: 12, padding: 24, display: "flex", flexDirection: "column" as const, gap: 12,
    }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <h3 style={{ fontWeight: 600, fontSize: 16, marginBottom: 4, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" as const }}>
            {service.name}
          </h3>
          <p style={{ fontSize: 12, color: "var(--muted)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" as const }}>
            {service.endpoint}
          </p>
        </div>
        <span style={{
          padding: "3px 10px", background: "rgba(20,241,149,0.1)", color: "var(--green)",
          borderRadius: 20, fontSize: 11, fontWeight: 600, whiteSpace: "nowrap" as const, marginLeft: 12,
        }}>● Active</span>
      </div>

      <p style={{ fontSize: 13, color: "var(--muted)", lineHeight: 1.5 }}>{service.description}</p>

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 4 }}>
        <div>
          <span style={{ fontSize: 22, fontWeight: 800, color: "var(--accent)" }}>
            {lamportsToSol(service.priceLamports)} SOL
          </span>
          <span style={{ fontSize: 12, color: "var(--muted)", marginLeft: 6 }}>/ call</span>
        </div>
        <span style={{ fontSize: 12, color: "var(--muted)" }}>
          {service.callsServed.toLocaleString()} calls
        </span>
      </div>

      <div style={{ fontSize: 11, color: "var(--muted)", borderTop: "1px solid var(--border)", paddingTop: 12, fontFamily: "monospace" }}>
        {service.provider.slice(0, 12)}…{service.provider.slice(-8)}
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
  } catch {
    error = "Could not load services from devnet. RPC may be slow — refresh to retry.";
  }

  const totalVolume = services.reduce((acc, s) => acc + s.callsServed * s.priceLamports, 0);

  return (
    <main style={{ maxWidth: 1100, margin: "0 auto", padding: "60px 24px" }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 40, flexWrap: "wrap" as const, gap: 16 }}>
        <div>
          <h1 style={{ fontSize: 32, fontWeight: 800, marginBottom: 6 }}>Service Marketplace</h1>
          <p style={{ color: "var(--muted)", fontSize: 15 }}>
            Live on Solana devnet · {services.length} service{services.length !== 1 ? "s" : ""} registered
          </p>
        </div>
        <Link href="/register" style={{
          background: "var(--accent)", color: "#fff",
          padding: "10px 22px", borderRadius: 8, fontWeight: 600, fontSize: 14,
        }}>
          + Register your API
        </Link>
      </div>

      {/* Stats row */}
      {services.length > 0 && (
        <div style={{ display: "flex", gap: 16, marginBottom: 40, flexWrap: "wrap" as const }}>
          {[
            { label: "Services", value: services.length.toString() },
            { label: "Total calls", value: services.reduce((a, s) => a + s.callsServed, 0).toLocaleString() },
            { label: "Total volume", value: `${(totalVolume / 1e9).toFixed(4)} SOL` },
            { label: "Network", value: "Devnet" },
          ].map(({ label, value }) => (
            <div key={label} style={{
              flex: "1 1 120px", background: "var(--surface)",
              border: "1px solid var(--border)", borderRadius: 10, padding: "14px 18px",
            }}>
              <div style={{ fontSize: 18, fontWeight: 700, color: "var(--accent)" }}>{value}</div>
              <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 2 }}>{label}</div>
            </div>
          ))}
        </div>
      )}

      {/* Quick-use snippet */}
      {services.length > 0 && (
        <div style={{
          background: "var(--surface)", border: "1px solid var(--border)",
          borderRadius: 10, padding: "14px 20px", marginBottom: 36, fontSize: 13,
        }}>
          <span style={{ color: "var(--muted)" }}>// Access any service with one line — payment handled automatically:</span>
          <br />
          <code>
            {"const data = await client.fetch("}
            <span style={{ color: "var(--green)" }}>&quot;{services[0]?.endpoint ?? "https://api.example.com/data"}&quot;</span>
            {");"}
          </code>
        </div>
      )}

      {/* Error */}
      {error && (
        <div style={{ color: "#f87171", padding: 16, border: "1px solid #7f1d1d", borderRadius: 8, marginBottom: 32 }}>
          {error}
        </div>
      )}

      {/* Empty state */}
      {!error && services.length === 0 && (
        <div style={{ textAlign: "center", padding: "80px 0", color: "var(--muted)" }}>
          <p style={{ fontSize: 18, marginBottom: 8 }}>No services registered yet.</p>
          <Link href="/register" style={{ color: "var(--accent)", fontWeight: 600 }}>
            Register the first one →
          </Link>
        </div>
      )}

      {/* Grid */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: 20 }}>
        {services.map((service) => (
          <ServiceCard key={service.pubkey} service={service} />
        ))}
      </div>

      {/* CTA */}
      <div style={{
        marginTop: 60, padding: 40,
        background: "rgba(153,69,255,0.06)", border: "1px solid rgba(153,69,255,0.25)",
        borderRadius: 16, textAlign: "center",
      }}>
        <h2 style={{ fontSize: 22, fontWeight: 700, marginBottom: 10 }}>List your API here</h2>
        <p style={{ color: "var(--muted)", marginBottom: 20, fontSize: 14 }}>
          Any HTTP endpoint can be monetized for AI agent consumption. Agents pay per call in SOL, instantly.
        </p>
        <Link href="/register" style={{
          display: "inline-block", background: "var(--accent)", color: "#fff",
          padding: "10px 24px", borderRadius: 8, fontWeight: 600, fontSize: 14,
        }}>Register your API →</Link>
      </div>
    </main>
  );
}
