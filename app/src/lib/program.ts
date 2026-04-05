import { Connection, PublicKey } from "@solana/web3.js";
import * as anchor from "@coral-xyz/anchor";
import { PROGRAM_ID, MARKETPLACE_PDA, SERVICE_SEED, RPC_URL } from "./constants";

export function getConnection(): Connection {
  return new Connection(RPC_URL, "confirmed");
}

export function getServicePda(providerPubkey: PublicKey): PublicKey {
  const [pda] = PublicKey.findProgramAddressSync(
    [SERVICE_SEED, providerPubkey.toBuffer()],
    PROGRAM_ID
  );
  return pda;
}

export interface MarketplaceState {
  admin: string;
  feeBps: number;
  totalServices: number;
  totalVolume: number;
}

export interface ServiceState {
  provider: string;
  name: string;
  endpoint: string;
  description: string;
  priceLamports: number;
  callsServed: number;
  active: boolean;
  pubkey: string;
}

/**
 * Fetch all Service accounts from the program using getProgramAccounts.
 * Filters by the Service account discriminator.
 */
export async function fetchAllServices(
  connection: Connection
): Promise<ServiceState[]> {
  // Service discriminator: first 8 bytes of SHA-256("account:Service")
  const SERVICE_DISCRIMINATOR = Buffer.from([
    0xdb, 0x8e, 0x82, 0x2f, 0xa0, 0xf3, 0x44, 0x6e,
  ]);

  const accounts = await connection.getProgramAccounts(PROGRAM_ID, {
    commitment: "confirmed",
    filters: [
      {
        memcmp: {
          offset: 0,
          bytes: SERVICE_DISCRIMINATOR.toString("base64"),
          encoding: "base64",
        },
      },
    ],
  });

  return accounts
    .map(({ pubkey, account }) => {
      try {
        return decodeServiceAccount(pubkey, account.data);
      } catch {
        return null;
      }
    })
    .filter((s): s is ServiceState => s !== null && s.active);
}

function decodeServiceAccount(
  pubkey: PublicKey,
  data: Buffer
): ServiceState | null {
  // Skip 8-byte discriminator
  let offset = 8;

  const provider = new PublicKey(data.slice(offset, offset + 32));
  offset += 32;

  const nameLen = data.readUInt32LE(offset);
  offset += 4;
  const name = data.slice(offset, offset + nameLen).toString("utf8");
  offset += nameLen;

  const endpointLen = data.readUInt32LE(offset);
  offset += 4;
  const endpoint = data.slice(offset, offset + endpointLen).toString("utf8");
  offset += endpointLen;

  const descLen = data.readUInt32LE(offset);
  offset += 4;
  const description = data.slice(offset, offset + descLen).toString("utf8");
  offset += descLen;

  const priceLamports = Number(data.readBigUInt64LE(offset));
  offset += 8;

  const callsServed = Number(data.readBigUInt64LE(offset));
  offset += 8;

  const active = data[offset] === 1;

  return {
    provider: provider.toBase58(),
    name,
    endpoint,
    description,
    priceLamports,
    callsServed,
    active,
    pubkey: pubkey.toBase58(),
  };
}
