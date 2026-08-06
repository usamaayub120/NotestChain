import { Connection, Keypair, PublicKey } from "@solana/web3.js";
import { createRequire } from "node:module";
import { createProgram } from "@noteschain/blockchain-client";
import { env } from "../config/env.js";

// @coral-xyz/anchor is CJS — see packages/blockchain-client/src/program.ts
// for why this uses createRequire rather than a default import.
const require = createRequire(import.meta.url);
const { Wallet } = require("@coral-xyz/anchor") as typeof import("@coral-xyz/anchor");

let cached: {
  connection: Connection;
  program: ReturnType<typeof createProgram>;
} | null = null;

/**
 * The API only ever reads accounts (verification, reconciliation reads) —
 * it must never hold real signing authority, so the provider wallet is a
 * throwaway keypair generated fresh each process start rather than loaded
 * from disk/env. `program.account.*.fetch()` never signs anything.
 */
export function getReadOnlySolanaClient() {
  if (cached) return cached;

  const connection = new Connection(env.SOLANA_RPC_HTTP_URL, env.SOLANA_COMMITMENT);
  const wallet = new Wallet(Keypair.generate());
  const program = createProgram(connection, wallet);

  cached = { connection, program };
  return cached;
}

export function programId(): PublicKey {
  return new PublicKey(env.SOLANA_PROGRAM_ID);
}
