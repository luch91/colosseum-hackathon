import * as anchor from "@anchor-lang/core";
import { Program, BN } from "@anchor-lang/core";
import { PublicKey, Keypair, SystemProgram, LAMPORTS_PER_SOL } from "@solana/web3.js";
import { assert } from "chai";

// Import generated IDL type after `anchor build`
// import { Agentpay } from "../target/types/agentpay";

const MARKETPLACE_SEED = Buffer.from("marketplace");
const SERVICE_SEED = Buffer.from("service");
const PAYMENT_SEED = Buffer.from("payment");

describe("agentpay", () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  // const program = anchor.workspace.Agentpay as Program<Agentpay>;
  const programId = new PublicKey("AGNTPay1111111111111111111111111111111111111");

  const admin = provider.wallet as anchor.Wallet;
  const providerKeypair = Keypair.generate();
  const payerKeypair = Keypair.generate();

  const [marketplacePda] = PublicKey.findProgramAddressSync(
    [MARKETPLACE_SEED],
    programId
  );

  const [servicePda] = PublicKey.findProgramAddressSync(
    [SERVICE_SEED, providerKeypair.publicKey.toBuffer()],
    programId
  );

  before(async () => {
    // Airdrop SOL to test wallets
    await provider.connection.requestAirdrop(
      providerKeypair.publicKey,
      2 * LAMPORTS_PER_SOL
    );
    await provider.connection.requestAirdrop(
      payerKeypair.publicKey,
      2 * LAMPORTS_PER_SOL
    );
    // Wait for confirmation
    await new Promise((r) => setTimeout(r, 2000));
  });

  it("initializes the marketplace", async () => {
    // Uncomment after anchor build:
    // await program.methods
    //   .initialize(50) // 0.5% fee
    //   .accounts({
    //     marketplace: marketplacePda,
    //     admin: admin.publicKey,
    //     systemProgram: SystemProgram.programId,
    //   })
    //   .rpc();
    //
    // const state = await program.account.marketplace.fetch(marketplacePda);
    // assert.equal(state.feeBps, 50);
    // assert.equal(state.totalServices.toNumber(), 0);
    // assert.ok(state.admin.equals(admin.publicKey));
    console.log("  [stub] marketplace initialized — uncomment after anchor build");
  });

  it("registers a service", async () => {
    // await program.methods
    //   .registerService(
    //     "Solana Price Feed",
    //     "https://api.agentpay.xyz/solana-price",
    //     "Real-time SOL/USD price from multiple aggregators",
    //     new BN(1_000_000) // 0.001 SOL
    //   )
    //   .accounts({
    //     service: servicePda,
    //     marketplace: marketplacePda,
    //     provider: providerKeypair.publicKey,
    //     systemProgram: SystemProgram.programId,
    //   })
    //   .signers([providerKeypair])
    //   .rpc();
    //
    // const service = await program.account.service.fetch(servicePda);
    // assert.equal(service.name, "Solana Price Feed");
    // assert.equal(service.priceLamports.toNumber(), 1_000_000);
    // assert.ok(service.active);
    console.log("  [stub] service registered — uncomment after anchor build");
  });

  it("pays for a service and creates a PaymentRecord", async () => {
    // const requestHash = Array.from(crypto.getRandomValues(new Uint8Array(32)));
    //
    // const [paymentRecordPda] = PublicKey.findProgramAddressSync(
    //   [
    //     PAYMENT_SEED,
    //     servicePda.toBuffer(),
    //     payerKeypair.publicKey.toBuffer(),
    //     Buffer.from(requestHash),
    //   ],
    //   programId
    // );
    //
    // const providerBalanceBefore = await provider.connection.getBalance(providerKeypair.publicKey);
    //
    // await program.methods
    //   .payForService(requestHash)
    //   .accounts({
    //     paymentRecord: paymentRecordPda,
    //     service: servicePda,
    //     marketplace: marketplacePda,
    //     provider: providerKeypair.publicKey,
    //     admin: admin.publicKey,
    //     payer: payerKeypair.publicKey,
    //     systemProgram: SystemProgram.programId,
    //   })
    //   .signers([payerKeypair])
    //   .rpc();
    //
    // const record = await program.account.paymentRecord.fetch(paymentRecordPda);
    // assert.ok(record.payer.equals(payerKeypair.publicKey));
    // assert.equal(record.amount.toNumber(), 1_000_000);
    // assert.ok(!record.used);
    //
    // // Verify provider received ~0.001 SOL minus fee
    // const providerBalanceAfter = await provider.connection.getBalance(providerKeypair.publicKey);
    // assert.isAbove(providerBalanceAfter, providerBalanceBefore);
    console.log("  [stub] payment recorded — uncomment after anchor build");
  });

  it("consumes a payment (marks as used, prevents replay)", async () => {
    // After consuming, a second consume call should fail with PaymentAlreadyUsed
    console.log("  [stub] consume payment — uncomment after anchor build");
  });

  it("rejects inactive service payments", async () => {
    // Toggle service inactive, then attempt pay_for_service — should throw ServiceInactive
    console.log("  [stub] inactive service rejection — uncomment after anchor build");
  });

  it("rejects fee > 10%", async () => {
    // Try initialize with fee_bps = 1001 — should throw FeeTooHigh
    console.log("  [stub] fee validation — uncomment after anchor build");
  });
});
