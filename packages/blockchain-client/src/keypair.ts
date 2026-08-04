import { readFileSync } from "node:fs";
import { Keypair } from "@solana/web3.js";

export interface LoadPublisherKeypairOptions {
  /** e.g. SOLANA_PUBLISHER_KEYPAIR_PATH — a JSON array secret file, mounted read-only. */
  keypairPath?: string;
  /** e.g. SOLANA_PUBLISHER_KEYPAIR_JSON — local dev only, never set in production. */
  keypairJson?: string;
  nodeEnv?: string;
}

/**
 * Loads the platform's Solana publishing keypair. Never accepts a key over
 * HTTP, never logs its contents, and refuses the env-var fallback outside
 * development so a misconfigured production deploy fails loudly instead of
 * silently trusting an env var that could leak into process listings/logs.
 */
export function loadPublisherKeypair(options: LoadPublisherKeypairOptions): Keypair {
  const { keypairPath, keypairJson, nodeEnv = "development" } = options;

  if (keypairPath) {
    const raw = readFileSync(keypairPath, "utf8");
    return Keypair.fromSecretKey(Uint8Array.from(JSON.parse(raw)));
  }

  if (keypairJson) {
    if (nodeEnv === "production") {
      throw new Error(
        "SOLANA_PUBLISHER_KEYPAIR_JSON is a development-only fallback and must not be used " +
          "when NODE_ENV=production. Set SOLANA_PUBLISHER_KEYPAIR_PATH to a mounted secret instead.",
      );
    }
    return Keypair.fromSecretKey(Uint8Array.from(JSON.parse(keypairJson)));
  }

  throw new Error(
    "No publisher keypair configured. Set SOLANA_PUBLISHER_KEYPAIR_PATH " +
      "(production) or SOLANA_PUBLISHER_KEYPAIR_JSON (development only).",
  );
}
