import { Connection, PublicKey } from "@solana/web3.js";
// Default-import + destructure — see the comment in publishToChain.ts for why.
import anchorPkg, { type Wallet } from "@coral-xyz/anchor";
import { createProgram, loadPublisherKeypair } from "@noteschain/blockchain-client";
import { env } from "../config/env.js";

const { Wallet: WalletCtor } = anchorPkg;

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
