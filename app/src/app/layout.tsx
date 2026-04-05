import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "AgentPay — x402 Machine Payment Marketplace on Solana",
  description:
    "AI agents pay for API services autonomously. No subscriptions. No approvals. Settle on Solana in < 1 second.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
