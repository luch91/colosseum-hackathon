import type { Metadata } from "next";
import Link from "next/link";
import WalletButton from "@/components/WalletButton";
import "./globals.css";

export const metadata: Metadata = {
  title: "AgentPay — x402 Machine Payment Marketplace on Solana",
  description:
    "AI agents pay for API services autonomously. No subscriptions. No approvals. Settle on Solana in < 1 second.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <nav style={{
          position: "sticky", top: 0, zIndex: 100,
          borderBottom: "1px solid var(--border)",
          background: "rgba(10,10,15,0.85)",
          backdropFilter: "blur(12px)",
          padding: "0 24px",
        }}>
          <div style={{
            maxWidth: 1100, margin: "0 auto",
            display: "flex", alignItems: "center", justifyContent: "space-between",
            height: 56,
          }}>
            <Link href="/" style={{ fontWeight: 800, fontSize: 18, color: "var(--accent)", letterSpacing: -0.5 }}>
              AgentPay
            </Link>
            <div style={{ display: "flex", alignItems: "center", gap: 24, fontSize: 14 }}>
              <Link href="/marketplace" style={{ color: "var(--muted)" }}>Marketplace</Link>
              <Link href="/register" style={{ color: "var(--muted)" }}>Register API</Link>
              <Link href="/demo" style={{ color: "var(--muted)" }}>Live Demo</Link>
              <a href="https://github.com/luch91/colosseum-hackathon" target="_blank" rel="noreferrer" style={{ color: "var(--muted)" }}>GitHub</a>
              <WalletButton />
            </div>
          </div>
        </nav>
        {children}
      </body>
    </html>
  );
}
