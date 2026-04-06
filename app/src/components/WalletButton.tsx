"use client";
import { useState, useEffect } from "react";

declare global {
  interface Window {
    solana?: {
      isPhantom?: boolean;
      isConnected?: boolean;
      publicKey?: { toString(): string };
      connect(opts?: { onlyIfTrusted?: boolean }): Promise<{ publicKey: { toString(): string } }>;
      disconnect(): Promise<void>;
      signAndSendTransaction(tx: unknown): Promise<{ signature: string }>;
    };
  }
}

export function usePhantom() {
  const [address, setAddress] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window !== "undefined" && window.solana?.isConnected) {
      setAddress(window.solana.publicKey?.toString() ?? null);
    }
  }, []);

  async function connect(): Promise<string | null> {
    if (!window.solana?.isPhantom) {
      window.open("https://phantom.app", "_blank");
      return null;
    }
    const resp = await window.solana.connect();
    const addr = resp.publicKey.toString();
    setAddress(addr);
    return addr;
  }

  async function disconnect() {
    await window.solana?.disconnect();
    setAddress(null);
  }

  return { address, connect, disconnect };
}

export default function WalletButton() {
  const { address, connect, disconnect } = usePhantom();
  const [loading, setLoading] = useState(false);

  async function handleClick() {
    setLoading(true);
    try {
      if (address) await disconnect();
      else await connect();
    } catch {
      // user rejected
    } finally {
      setLoading(false);
    }
  }

  const connected = !!address;

  return (
    <button
      onClick={handleClick}
      disabled={loading}
      style={{
        background: connected ? "rgba(20,241,149,0.1)" : "var(--accent)",
        border: connected ? "1px solid rgba(20,241,149,0.4)" : "none",
        color: connected ? "var(--green)" : "#fff",
        padding: "8px 16px",
        borderRadius: 8,
        cursor: "pointer",
        fontSize: 14,
        fontWeight: 600,
        transition: "all 0.15s",
      }}
    >
      {loading
        ? "..."
        : connected
        ? `${address!.slice(0, 4)}…${address!.slice(-4)}`
        : "Connect Wallet"}
    </button>
  );
}
