import {
  Connection,
  PublicKey,
  Transaction,
  SystemProgram,
  Keypair,
} from "@solana/web3.js";
import type { PaymentRequirements, PaymentProof } from "./types";

/**
 * Minimal wallet interface — compatible with Anchor's NodeWallet and browser wallets.
 */
export interface Wallet {
  publicKey: PublicKey;
  signTransaction(tx: Transaction): Promise<Transaction>;
}

/**
 * X402Client wraps `fetch` and transparently handles HTTP 402 responses.
 *
 * When a 402 is received:
 *   1. Parses X-Payment-Required header
 *   2. Sends a Solana transaction (pay_for_service)
 *   3. Retries the original request with X-Payment-Proof header
 *
 * Usage:
 *   const client = new X402Client(connection, wallet, programId);
 *   const res = await client.fetch("https://api.example.com/data");
 */
export class X402Client {
  constructor(
    private readonly connection: Connection,
    private readonly wallet: Wallet,
    private readonly programId: PublicKey
  ) {}

  async fetch(url: string, init?: RequestInit): Promise<Response> {
    const response = await globalThis.fetch(url, init);

    if (response.status !== 402) {
      return response;
    }

    const paymentHeader = response.headers.get("X-Payment-Required");
    if (!paymentHeader) {
      throw new Error("Server returned 402 without X-Payment-Required header");
    }

    const requirements: PaymentRequirements = JSON.parse(paymentHeader);
    const requestHash = await this.deriveRequestHash(url, init);
    const proof = await this.sendPayment(requirements, requestHash);

    const retryHeaders = new Headers(init?.headers);
    retryHeaders.set("X-Payment-Proof", JSON.stringify(proof));

    return globalThis.fetch(url, { ...init, headers: retryHeaders });
  }

  /**
   * Derive a deterministic 32-byte hash for this specific request.
   * Includes a timestamp to ensure uniqueness across repeated calls.
   */
  private async deriveRequestHash(
    url: string,
    init?: RequestInit
  ): Promise<string> {
    const raw = `${url}||${JSON.stringify(init?.body ?? "")}||${Date.now()}||${
      this.wallet.publicKey.toBase58()
    }`;
    const buffer = await crypto.subtle.digest(
      "SHA-256",
      new TextEncoder().encode(raw)
    );
    return Buffer.from(buffer).toString("hex");
  }

  private async sendPayment(
    req: PaymentRequirements,
    requestHashHex: string
  ): Promise<PaymentProof> {
    const requestHashBytes = Buffer.from(requestHashHex, "hex");
    if (requestHashBytes.length !== 32) {
      throw new Error("Request hash must be exactly 32 bytes");
    }

    const servicePubkey = new PublicKey(req.service_pubkey);
    const providerPubkey = new PublicKey(req.provider_pubkey);
    const adminPubkey = new PublicKey(req.admin_pubkey);
    const marketplacePubkey = new PublicKey(req.marketplace_pubkey);

    // Derive PaymentRecord PDA
    const [paymentRecordPda] = PublicKey.findProgramAddressSync(
      [
        Buffer.from("payment"),
        servicePubkey.toBuffer(),
        this.wallet.publicKey.toBuffer(),
        requestHashBytes,
      ],
      this.programId
    );

    // Build pay_for_service transaction using direct instruction data.
    // In production, use the generated IDL via @anchor-lang/core.
    // Instruction discriminator for pay_for_service (first 8 bytes of sha256("global:pay_for_service"))
    const discriminator = Buffer.from([
      0x7a, 0x5e, 0xc4, 0x3d, 0xb1, 0x22, 0x9f, 0x6c,
    ]);

    const data = Buffer.concat([discriminator, requestHashBytes]);

    const { blockhash, lastValidBlockHeight } =
      await this.connection.getLatestBlockhash("confirmed");

    const tx = new Transaction({
      recentBlockhash: blockhash,
      feePayer: this.wallet.publicKey,
    });

    // Add compute budget instruction to be safe with PDA creation
    tx.add({
      keys: [
        { pubkey: paymentRecordPda, isSigner: false, isWritable: true },
        { pubkey: servicePubkey, isSigner: false, isWritable: true },
        { pubkey: marketplacePubkey, isSigner: false, isWritable: true },
        { pubkey: providerPubkey, isSigner: false, isWritable: true },
        { pubkey: adminPubkey, isSigner: false, isWritable: true },
        { pubkey: this.wallet.publicKey, isSigner: true, isWritable: true },
        {
          pubkey: SystemProgram.programId,
          isSigner: false,
          isWritable: false,
        },
      ],
      programId: this.programId,
      data,
    });

    const signedTx = await this.wallet.signTransaction(tx);
    const signature = await this.connection.sendRawTransaction(
      signedTx.serialize(),
      { skipPreflight: false, preflightCommitment: "confirmed" }
    );

    await this.connection.confirmTransaction(
      { signature, blockhash, lastValidBlockHeight },
      "confirmed"
    );

    return { tx_signature: signature, request_hash: requestHashHex };
  }
}
