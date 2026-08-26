import { z } from "zod";

/**
 * The Firebase credential shape, shared between apps/api and apps/worker —
 * mirrors @noteschain/email's emailEnvShape and, more directly, the
 * SOLANA_PUBLISHER_KEYPAIR_PATH/_JSON pair in
 * packages/blockchain-client/src/keypair.ts: a mounted-secret path in
 * production, an inline JSON env var for local dev only. The API never
 * loads this at all — it only enqueues PushJob rows — so it can start
 * without Firebase configured; the worker is the process that actually
 * sends, and it's the one that decides how hard to fail when it's missing
 * (see apps/worker/src/push/firebaseCredential.ts — soft, not a startup
 * crash, because push is an enhancement to the product, not core to it the
 * way SMTP or the Solana publisher key are).
 */
export const pushEnvShape = {
  FIREBASE_SERVICE_ACCOUNT_PATH: z.string().optional(),
  FIREBASE_SERVICE_ACCOUNT_JSON: z.string().optional(),
};

export type PushEnv = {
  FIREBASE_SERVICE_ACCOUNT_PATH?: string;
  FIREBASE_SERVICE_ACCOUNT_JSON?: string;
};

/** True once enough is configured to attempt loading a credential. */
export function isFirebaseConfigured(env: PushEnv): boolean {
  return Boolean(env.FIREBASE_SERVICE_ACCOUNT_PATH || env.FIREBASE_SERVICE_ACCOUNT_JSON);
}
