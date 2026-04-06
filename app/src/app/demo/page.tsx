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
import { RPC_URL } from "@/lib/constants";

const PROGRAM_ID = new PublicKey("5g9CxSn7N2iVJg6971vjMZBYR3KXwSVFuQe9P37JKSQy");
const PAYMENT_SEED = Buffer.from("payment");
const API_URL = "/api/prices";

type Step = "idle" | "fetching" | "got402" | "paying" | "retrying" | "done" | "error";

interface StepState {
  step: Step;
  requirements?: Record<string, unknown>;
  txSig?: string;
  data?: Record<string, unknown>;
  error?: string;
}

async function deriveRequestHash(payerAddress: string): Promise<string> {
  const raw = `${API_URL}||{}||${Date.now()}||${payerAddress}`;
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(raw));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, "0")).join("");
}

export default function DemoPage() {
  const { address, connect } = usePhantom();
  const [flow, setFlow] = useState<StepState>({ step: "idle" });

  async function runDemo() {
    let walletAddress = address;
    if (!walletAddress) {
      walletAddress = await connect();
      if (!walletAddress) return;
    }

    setFlow({ step: "fetching" });

    // Step 1: Hit the API — expect 402
    const res1 = await fetch(API_URL);
    if (res1.status !== 402) {
      setFlow({ step: "error", error: `Expected 402, got ${res1.status}` });
      return;
    }
    const body1 = await res1.json();
    const requirements = body1.requirements;
    setFlow({ step: "got402", requirements });

    await sleep(600);
    setFlow(f => ({ ...f, step: "paying" }));

    // Step 2: Build and send pay_for_service transaction
    try {
      const connection = new Connection(RPC_URL, "confirmed");
      const payerPubkey = new PublicKey(walletAddress);
      const requestHashHex = await deriveRequestHash(walletAddress);
      const requestHashBytes = Buffer.from(requestHashHex, "hex");

      const servicePubkey = new PublicKey(requirements.service_pubkey as string);
      const marketplacePubkey = new PublicKey(requirements.marketplace_pubkey as string);
      const providerPubkey = new PublicKey(requirements.provider_pubkey as string);
      const adminPubkey = new PublicKey(requirements.admin_pubkey as string);

      const [paymentRecordPda] = PublicKey.findProgramAddressSync(
        [PAYMENT_SEED, servicePubkey.toBuffer(), payerPubkey.toBuffer(), requestHashBytes],
        PROGRAM_ID
      );

      // Discriminator: sha256("global:pay_for_service")[0..8]
      const disc = Buffer.from([0xb1, 0x26, 0x5d, 0x59, 0x10, 0x09, 0xce, 0x11]);
      const { blockhash } = await connection.getLatestBlockhash("confirmed");

      const tx = new Transaction({ recentBlockhash: blockhash, feePayer: payerPubkey }).add(
        new TransactionInstruction({
          keys: [
            { pubkey: paymentRecordPda, isSigner: false, isWritable: true },
            { pubkey: servicePubkey, isSigner: false, isWritable: true },
            { pubkey: marketplacePubkey, isSigner: false, isWritable: true },
            { pubkey: providerPubkey, isSigner: false, isWritable: true },
            { pubkey: adminPubkey, isSigner: false, isWritable: true },
            { pubkey: payerPubkey, isSigner: true, isWritable: true },
            { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
          ],
          programId: PROGRAM_ID,
          data: Buffer.concat([disc, requestHashBytes]),
        })
      );

      const { signature } = await window.solana!.signAndSendTransaction(tx);
      await connection.confirmTransaction(signature, "confirmed");

      setFlow(f => ({ ...f, step: "retrying", txSig: signature }));
      await sleep(400);

      // Step 3: Retry with proof
      const proof = JSON.stringify({ tx_signature: signature, request_hash: requestHashHex });
      const res2 = await fetch(API_URL, { headers: { "X-Payment-Proof": proof } });
      const data = await res2.json();

      setFlow({ step: "done", requirements, txSig: signature, data });
    } catch (err: unknown) {
      setFlow(f => ({ ...f, step: "error", error: err instanceof Error ? err.message : String(err) }));
    }
  }

  function reset() {
    setFlow({ step: "idle" });
  }

  const { step, requirements, txSig, data, error } = flow;
  const isRunning = ["fetching", "got402", "paying", "retrying"].includes(step);

  return (
    <main style={{ maxWidth: 780, margin: "60px auto", padding: "0 24px" }}>
      <div style={{ marginBottom: 40 }}>
        <h1 style={{ fontSize: 32, fontWeight: 800, marginBottom: 8 }}>Live x402 Demo</h1>
        <p style={{ color: "var(--muted)", fontSize: 15 }}>
          Watch an AI agent pay for API access in real time. Requires Phantom wallet on Solana devnet.
        </p>
      </div>

      {/* Flow diagram */}
      <div style={{ display: "flex", gap: 0, marginBottom: 32, overflowX: "auto" as const }}>
        {[
          { id: "fetching", label: "Request", sub: "GET /api/prices" },
          { id: "got402", label: "402", sub: "Payment required" },
          { id: "paying", label: "Pay", sub: "On-chain tx" },
          { id: "retrying", label: "Retry", sub: "With proof" },
          { id: "done", label: "Data", sub: "Response served" },
        ].map(({ id, label, sub }, i) => {
          const allSteps: Step[] = ["fetching", "got402", "paying", "retrying", "done"];
          const currentIdx = allSteps.indexOf(step as Step);
          const thisIdx = allSteps.indexOf(id as Step);
          const active = step === id;
          const done = currentIdx > thisIdx || step === "done";
          void i;
          return (
            <div key={id} style={{ display: "flex", alignItems: "center" }}>
              <div style={{
                textAlign: "center", padding: "12px 20px", minWidth: 110,
                background: done ? "rgba(153,69,255,0.15)" : active ? "rgba(153,69,255,0.08)" : "var(--surface)",
                border: `1px solid ${done ? "rgba(153,69,255,0.6)" : "var(--border)"}`,
                borderRadius: 10,
              }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: done ? "var(--accent)" : "var(--muted)" }}>{label}</div>
                <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 2 }}>{sub}</div>
              </div>
              {i < 4 && <div style={{ width: 24, height: 1, background: "var(--border)", flexShrink: 0 }} />}
            </div>
          );
        })}
      </div>

      {/* Action button */}
      {step === "idle" && (
        <button onClick={runDemo} style={{
          background: "var(--accent)", color: "#fff", border: "none",
          padding: "13px 32px", borderRadius: 8, fontWeight: 700, fontSize: 15,
          cursor: "pointer", marginBottom: 32,
        }}>
          {address ? "▶  Run x402 Demo" : "Connect Wallet & Run Demo"}
        </button>
      )}
      {isRunning && (
        <div style={{ marginBottom: 32, color: "var(--muted)", fontSize: 14, display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ animation: "spin 1s linear infinite", display: "inline-block" }}>⟳</span>
          {step === "fetching" && "Making request..."}
          {step === "got402" && "Got 402 — reading payment requirements..."}
          {step === "paying" && "Signing transaction with Phantom..."}
          {step === "retrying" && "Payment confirmed — retrying with proof..."}
        </div>
      )}

      {/* Step details */}
      {step !== "idle" && requirements && (
        <div style={{ marginBottom: 20 }}>
          <StepCard
            title="→ 402 Payment Required"
            color="var(--accent)"
            content={JSON.stringify(requirements, null, 2)}
          />
        </div>
      )}

      {txSig && (
        <div style={{ marginBottom: 20 }}>
          <StepCard
            title="✓ Solana transaction confirmed"
            color="var(--green)"
            content={`Signature: ${txSig}`}
            link={`https://explorer.solana.com/tx/${txSig}?cluster=devnet`}
          />
        </div>
      )}

      {step === "done" && data && (
        <div style={{ marginBottom: 32 }}>
          <StepCard
            title="✓ Data served — payment verified"
            color="var(--green)"
            content={JSON.stringify(data, null, 2)}
          />
          <button onClick={reset} style={{
            marginTop: 16, background: "transparent", border: "1px solid var(--border)",
            color: "var(--muted)", padding: "8px 20px", borderRadius: 8, cursor: "pointer", fontSize: 13,
          }}>Run again</button>
        </div>
      )}

      {step === "error" && (
        <div style={{ color: "#f87171", padding: "12px 16px", background: "rgba(248,113,113,0.08)", borderRadius: 8, border: "1px solid rgba(248,113,113,0.3)", marginBottom: 24 }}>
          <strong>Error:</strong> {error}
          <button onClick={reset} style={{
            marginLeft: 16, background: "transparent", border: "1px solid rgba(248,113,113,0.4)",
            color: "#f87171", padding: "4px 12px", borderRadius: 6, cursor: "pointer", fontSize: 12,
          }}>Retry</button>
        </div>
      )}

      {/* Info box */}
      <div style={{
        background: "var(--surface)", border: "1px solid var(--border)",
        borderRadius: 12, padding: 24, fontSize: 13, color: "var(--muted)", lineHeight: 1.7,
      }}>
        <p style={{ marginBottom: 8, color: "var(--text)", fontWeight: 600 }}>What&apos;s happening under the hood</p>
        <p>1. Your browser hits <code>/api/prices</code> → server returns HTTP 402 with on-chain payment requirements.</p>
        <p>2. Your Phantom wallet signs a <code>pay_for_service</code> transaction on Solana devnet (10,000 lamports ≈ $0.0014).</p>
        <p>3. Your browser retries with <code>X-Payment-Proof: &#123; tx_signature, request_hash &#125;</code>.</p>
        <p>4. Server verifies the transaction on-chain and returns the paid data.</p>
        <p style={{ marginTop: 8 }}>This is the x402 protocol — HTTP 402 + Solana = autonomous machine payments.</p>
      </div>

      <style>{`@keyframes spin { from { transform: rotate(0deg) } to { transform: rotate(360deg) } }`}</style>
    </main>
  );
}

function StepCard({
  title, color, content, link,
}: {
  title: string; color: string; content: string; link?: string;
}) {
  return (
    <div style={{
      background: "var(--surface)", border: `1px solid ${color}33`,
      borderRadius: 12, padding: 20,
    }}>
      <div style={{ fontSize: 13, fontWeight: 700, color, marginBottom: 10 }}>{title}</div>
      {link ? (
        <a href={link} target="_blank" rel="noreferrer" style={{ fontSize: 12, wordBreak: "break-all" as const }}>
          {content}
        </a>
      ) : (
        <pre style={{ fontSize: 12, lineHeight: 1.6, color: "var(--text)", overflowX: "auto" as const, margin: 0 }}>
          {content}
        </pre>
      )}
    </div>
  );
}

function sleep(ms: number) {
  return new Promise(r => setTimeout(r, ms));
}
