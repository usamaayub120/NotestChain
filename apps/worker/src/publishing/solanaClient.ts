import { Connection, PublicKey } from "@solana/web3.js";
import { createRequire } from "node:module";
import type { Wallet } from "@coral-xyz/anchor";
import { createProgram, loadPublisherKeypair } from "@noteschain/blockchain-client";
import { env } from "../config/env.js";

// @coral-xyz/anchor is CJS — see packages/blockchain-client/src/program.ts
// for why this uses createRequire rather than a default import.
const require = createRequire(import.meta.url);
const { Wallet: WalletCtor } = require("@coral-xyz/anchor") as typeof import("@coral-xyz/anchor");

let cached: {
  connection: Connection;
  program: ReturnType<typeof createProgram>;
  wallet: Wallet;
  publisherPubkey: PublicKey;
} | null = null;

/** Lazily built and cached — the keypair is only read from disk/env once. */
export function getSolanaClient() {
  if (cached) return cached;

  const keypair = loadPublisherKeypair({
    keypairPath: env.SOLANA_PUBLISHER_KEYPAIR_PATH,
    keypairJson: env.SOLANA_PUBLISHER_KEYPAIR_JSON,
    nodeEnv: env.NODE_ENV,
  });

  const connection = new Connection(env.SOLANA_RPC_HTTP_URL, env.SOLANA_COMMITMENT);
  const wallet = new WalletCtor(keypair);
  const program = createProgram(connection, wallet);

  cached = { connection, program, wallet, publisherPubkey: keypair.publicKey };
  return cached;
}

export function programId(): PublicKey {
  return new PublicKey(env.SOLANA_PROGRAM_ID);
}
