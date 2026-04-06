"use client";
import { useState } from "react";
import {
  Connection,
  PublicKey,
  Transaction,
  TransactionInstruction,
  SystemProgram,
} from "@solana/web3.js";
import { usePhantom } from "@/components/WalletButton";
import { PROGRAM_ID, MARKETPLACE_PDA, RPC_URL } from "@/lib/constants";

const SERVICE_SEED = Buffer.from("service");

function encodeString(str: string): Buffer {
  const bytes = Buffer.from(str, "utf-8");
  const len = Buffer.alloc(4);
  len.writeUInt32LE(bytes.length, 0);
  return Buffer.concat([len, bytes]);
}

type RegisterState = "idle" | "connecting" | "sending" | "done" | "error";

export default function RegisterPage() {
  const { address, connect } = usePhantom();
  const [name, setName] = useState("");
  const [endpoint, setEndpoint] = useState("");
  const [description, setDescription] = useState("");
  const [priceSol, setPriceSol] = useState("0.00001");
  const [state, setState] = useState<RegisterState>("idle");
  const [result, setResult] = useState<{ sig: string; pda: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    let walletAddress = address;
    if (!walletAddress) {
      setState("connecting");
      walletAddress = await connect();
      if (!walletAddress) {
        setState("idle");
        return;
      }
    }

    setState("sending");
    try {
      const providerPubkey = new PublicKey(walletAddress);
      const priceLamports = BigInt(Math.round(parseFloat(priceSol) * 1_000_000_000));

      if (priceLamports <= BigInt(0)) throw new Error("Price must be > 0");
      if (name.length > 50) throw new Error("Name max 50 chars");
      if (endpoint.length > 200) throw new Error("Endpoint max 200 chars");
      if (description.length > 200) throw new Error("Description max 200 chars");

      const [servicePda] = PublicKey.findProgramAddressSync(
        [SERVICE_SEED, providerPubkey.toBuffer()],
        PROGRAM_ID
      );

      // Discriminator: sha256("global:register_service")[0..8]
      const discriminator = Buffer.from([0x0b, 0x85, 0x9e, 0xe8, 0xc1, 0x13, 0xe5, 0x49]);
      const priceData = Buffer.alloc(8);
      priceData.writeBigUInt64LE(priceLamports, 0);

      const ix = new TransactionInstruction({
        keys: [
          { pubkey: servicePda, isSigner: false, isWritable: true },
          { pubkey: MARKETPLACE_PDA, isSigner: false, isWritable: true },
          { pubkey: providerPubkey, isSigner: true, isWritable: true },
          { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
        ],
        programId: PROGRAM_ID,
        data: Buffer.concat([
          discriminator,
          encodeString(name),
          encodeString(endpoint),
          encodeString(description),
          priceData,
        ]),
      });

      const connection = new Connection(RPC_URL, "confirmed");
      const { blockhash } = await connection.getLatestBlockhash("confirmed");
      const tx = new Transaction({ recentBlockhash: blockhash, feePayer: providerPubkey }).add(ix);

      const { signature } = await window.solana!.signAndSendTransaction(tx);
      await connection.confirmTransaction(signature, "confirmed");

      setState("done");
      setResult({ sig: signature, pda: servicePda.toBase58() });
    } catch (err: unknown) {
      setState("error");
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  const inputStyle: React.CSSProperties = {
    width: "100%", padding: "10px 14px",
    background: "var(--surface)", border: "1px solid var(--border)",
    borderRadius: 8, color: "var(--text)", fontSize: 14,
    outline: "none", boxSizing: "border-box",
  };
  const labelStyle: React.CSSProperties = {
    display: "block", fontSize: 13, fontWeight: 600,
    color: "var(--muted)", marginBottom: 6,
  };

  if (state === "done" && result) {
    return (
      <main style={{ maxWidth: 640, margin: "80px auto", padding: "0 24px" }}>
        <div style={{
          background: "rgba(20,241,149,0.08)", border: "1px solid rgba(20,241,149,0.3)",
          borderRadius: 16, padding: 40, textAlign: "center",
        }}>
          <div style={{ fontSize: 40, marginBottom: 16 }}>✓</div>
          <h1 style={{ fontSize: 24, fontWeight: 700, color: "var(--green)", marginBottom: 8 }}>Service registered!</h1>
          <p style={{ color: "var(--muted)", marginBottom: 24, fontSize: 14 }}>
            Your service is live on the AgentPay marketplace.
          </p>
          <div style={{ textAlign: "left", background: "var(--surface)", borderRadius: 12, padding: 20, marginBottom: 24 }}>
            <div style={{ marginBottom: 12 }}>
              <span style={{ fontSize: 12, color: "var(--muted)", display: "block", marginBottom: 4 }}>SERVICE PDA</span>
              <code style={{ fontSize: 12, wordBreak: "break-all", color: "var(--accent)" }}>{result.pda}</code>
            </div>
            <div>
              <span style={{ fontSize: 12, color: "var(--muted)", display: "block", marginBottom: 4 }}>TRANSACTION</span>
              <a
                href={`https://explorer.solana.com/tx/${result.sig}?cluster=devnet`}
                target="_blank" rel="noreferrer"
                style={{ fontSize: 12, wordBreak: "break-all" }}
              >{result.sig.slice(0, 32)}…</a>
            </div>
          </div>
          <div style={{ background: "var(--surface)", borderRadius: 8, padding: 16, textAlign: "left", marginBottom: 24 }}>
            <p style={{ fontSize: 12, color: "var(--muted)", marginBottom: 8 }}>Add this to your API:</p>
            <pre style={{ fontSize: 11, lineHeight: 1.7, color: "var(--text)", overflowX: "auto" }}>{`import { x402NextMiddleware } from "@agentpay/sdk";

export const middleware = x402NextMiddleware({
  servicePubkey: "${result.pda}",
  marketplacePubkey: "${MARKETPLACE_PDA.toBase58()}",
  providerPubkey: "${address}",
  adminPubkey: "BV7Gd8ftjsFyy7P5iCShkspiA34YrDwNCPPiAHTZHFRR",
  priceLamports: ${Math.round(parseFloat(priceSol) * 1e9)},
  network: "devnet",
  rpcUrl: "https://api.devnet.solana.com",
  programId: "${PROGRAM_ID.toBase58()}",
});`}</pre>
          </div>
          <a href="/marketplace" style={{
            display: "inline-block", background: "var(--accent)", color: "#fff",
            padding: "10px 24px", borderRadius: 8, fontWeight: 600, fontSize: 14,
          }}>View on marketplace →</a>
        </div>
      </main>
    );
  }

  return (
    <main style={{ maxWidth: 640, margin: "60px auto", padding: "0 24px" }}>
      <div style={{ marginBottom: 36 }}>
        <h1 style={{ fontSize: 32, fontWeight: 800, marginBottom: 8 }}>Register your API</h1>
        <p style={{ color: "var(--muted)", fontSize: 15 }}>
          Monetize any HTTP endpoint for AI agent consumption in minutes.
          Agents pay per call — you receive SOL instantly.
        </p>
      </div>

      <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 20 }}>
        <div>
          <label style={labelStyle}>Service name <span style={{ color: "#f87171" }}>*</span></label>
          <input
            required value={name} onChange={e => setName(e.target.value)}
            placeholder="Weather API, GPT-4 Wrapper, ..."
            maxLength={50} style={inputStyle}
          />
        </div>

        <div>
          <label style={labelStyle}>Endpoint URL <span style={{ color: "#f87171" }}>*</span></label>
          <input
            required value={endpoint} onChange={e => setEndpoint(e.target.value)}
            placeholder="https://your-api.com/endpoint"
            maxLength={200} style={inputStyle}
          />
        </div>

        <div>
          <label style={labelStyle}>Description <span style={{ color: "#f87171" }}>*</span></label>
          <textarea
            required value={description} onChange={e => setDescription(e.target.value)}
            placeholder="What does this API return? What data does it provide?"
            maxLength={200} rows={3}
            style={{ ...inputStyle, resize: "vertical" as const }}
          />
        </div>

        <div>
          <label style={labelStyle}>Price per call (SOL) <span style={{ color: "#f87171" }}>*</span></label>
          <input
            required type="number" value={priceSol}
            onChange={e => setPriceSol(e.target.value)}
            min="0.000001" step="0.000001"
            style={inputStyle}
          />
          <p style={{ fontSize: 12, color: "var(--muted)", marginTop: 4 }}>
            = {Math.round(parseFloat(priceSol || "0") * 1_000_000_000).toLocaleString()} lamports
          </p>
        </div>

        {error && (
          <div style={{ color: "#f87171", fontSize: 13, padding: "10px 14px", background: "rgba(248,113,113,0.08)", borderRadius: 8, border: "1px solid rgba(248,113,113,0.3)" }}>
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={state === "sending" || state === "connecting"}
          style={{
            background: "var(--accent)", color: "#fff", border: "none",
            padding: "13px", borderRadius: 8, fontWeight: 700, fontSize: 15,
            cursor: "pointer", marginTop: 4,
          }}
        >
          {state === "connecting" ? "Connecting wallet..." :
           state === "sending" ? "Sending transaction..." :
           address ? "Register Service" : "Connect & Register"}
        </button>

        {!address && (
          <p style={{ fontSize: 12, color: "var(--muted)", textAlign: "center", marginTop: -8 }}>
            Requires Phantom wallet on Solana devnet
          </p>
        )}
      </form>
    </main>
  );
}
