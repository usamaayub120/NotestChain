import type { Connection, PublicKey } from "@solana/web3.js";

const LAMPORTS_PER_SOL = 1_000_000_000;

export type WalletStatus = "ok" | "low" | "unknown";

export interface WalletBalance {
  pubkey: string;
  balanceSol: number | null;
  status: WalletStatus;
}

/**
 * A plain balance read — no keypair, no signing, just `getBalance` against a
 * public key. Shared by the admin API endpoint and the worker's periodic
 * check so "what counts as low" is decided in exactly one place.
 */
export async function getWalletStatus(
  connection: Connection,
  pubkey: PublicKey,
  thresholdSol: number,
): Promise<WalletBalance> {
  try {
    const lamports = await connection.getBalance(pubkey);
    const balanceSol = lamports / LAMPORTS_PER_SOL;
    return { pubkey: pubkey.toBase58(), balanceSol, status: balanceSol < thresholdSol ? "low" : "ok" };
  } catch {
    return { pubkey: pubkey.toBase58(), balanceSol: null, status: "unknown" };
  }
}
