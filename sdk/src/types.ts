export interface PaymentRequirements {
  /** On-chain address of the Service PDA */
  service_pubkey: string;
  /** On-chain address of the Marketplace PDA */
  marketplace_pubkey: string;
  /** Provider wallet that receives payment */
  provider_pubkey: string;
  /** Admin wallet that receives fee */
  admin_pubkey: string;
  /** Amount in lamports */
  price_lamports: number;
  /** "mainnet-beta" | "devnet" | "localnet" */
  network: string;
  /** AgentPay program ID */
  program_id: string;
}

export interface PaymentProof {
  /** Confirmed Solana transaction signature */
  tx_signature: string;
  /** Hex-encoded 32-byte hash that was used as PDA seed */
  request_hash: string;
}

export interface ServiceRecord {
  provider: string;
  name: string;
  endpoint: string;
  description: string;
  price_lamports: number;
  calls_served: number;
  active: boolean;
}
