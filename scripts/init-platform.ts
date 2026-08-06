/**
 * One-time, manual platform initialization — deliberately NOT run
 * automatically on every deploy (see ARCHITECTURE.md §6 / migrations/deploy.ts
 * in the Anchor workspace). Run once per cluster (devnet, then eventually
 * mainnet) after the program itself has been deployed.
 *
 * Usage:
 *   SOLANA_RPC_HTTP_URL=... SOLANA_PROGRAM_ID=... \
 *   SOLANA_PUBLISHER_KEYPAIR_PATH=/path/to/publisher.json \
 *   [PLATFORM_TREASURY=<pubkey, defaults to the publisher's own address>] \
 *   pnpm exec tsx scripts/init-platform.ts
 */
import { Connection, PublicKey } from "@solana/web3.js";
import { createRequire } from "node:module";
import { createProgram, derivePlatformConfigPda, loadPublisherKeypair } from "@noteschain/blockchain-client";

// @coral-xyz/anchor is CJS — see packages/blockchain-client/src/program.ts
// for why this uses createRequire rather than a default import (this script
// specifically only ever runs under tsx, which is exactly the runtime where
// the default-import approach broke).
const require = createRequire(import.meta.url);
const { Wallet } = require("@coral-xyz/anchor") as typeof import("@coral-xyz/anchor");

async function main() {
  const rpcUrl = process.env.SOLANA_RPC_HTTP_URL ?? "https://api.devnet.solana.com";
  const programId = process.env.SOLANA_PROGRAM_ID;
  if (!programId) throw new Error("SOLANA_PROGRAM_ID is required.");

  const keypair = loadPublisherKeypair({
    keypairPath: process.env.SOLANA_PUBLISHER_KEYPAIR_PATH,
    keypairJson: process.env.SOLANA_PUBLISHER_KEYPAIR_JSON,
    nodeEnv: process.env.NODE_ENV ?? "development",
  });

  const connection = new Connection(rpcUrl, "confirmed");
  const wallet = new Wallet(keypair);
  const program = createProgram(connection, wallet);

  const [platformPda] = derivePlatformConfigPda(new PublicKey(programId));

  const existing = await connection.getAccountInfo(platformPda);
  if (existing) {
    console.log(`Platform already initialized at ${platformPda.toBase58()} — nothing to do.`);
    return;
  }

  const treasury = process.env.PLATFORM_TREASURY
    ? new PublicKey(process.env.PLATFORM_TREASURY)
    : keypair.publicKey;

  console.log(`Initializing platform at ${platformPda.toBase58()}`);
  console.log(`  authority: ${keypair.publicKey.toBase58()}`);
  console.log(`  treasury:  ${treasury.toBase58()}`);

  // platformConfig and systemProgram are auto-resolved by Anchor's client
  // (const seeds and a fixed address, respectively).
  const signature = await program.methods
    .initializePlatform(treasury)
    .accounts({
      authority: keypair.publicKey,
    })
    .rpc();

  console.log(`Done. Transaction: ${signature}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
