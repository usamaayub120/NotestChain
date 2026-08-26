import { readFileSync } from "node:fs";
import { cert, getApps, initializeApp, type App } from "firebase-admin/app";
import { env } from "../config/env.js";

/**
 * Same PATH/JSON pattern as packages/blockchain-client/src/keypair.ts's
 * loadPublisherKeypair — a mounted secret file in production, an inline
 * env var for local dev only, the JSON fallback refused outright once
 * NODE_ENV=production so a misconfigured deploy fails loudly instead of
 * silently trusting an env var that could leak into process listings/logs.
 *
 * Unlike the Solana keypair, a missing Firebase credential is not fatal at
 * worker startup (see env.ts's isFirebaseConfigured — push is an
 * enhancement, not core to the product the way chain publishing or SMTP
 * are). This only throws once something actually tries to send a push.
 */
function loadServiceAccount(): Record<string, unknown> {
  const { FIREBASE_SERVICE_ACCOUNT_PATH: path, FIREBASE_SERVICE_ACCOUNT_JSON: json, NODE_ENV: nodeEnv } = env;

  if (path) {
    return JSON.parse(readFileSync(path, "utf8"));
  }

  if (json) {
    if (nodeEnv === "production") {
      throw new Error(
        "FIREBASE_SERVICE_ACCOUNT_JSON is a development-only fallback and must not be used " +
          "when NODE_ENV=production. Set FIREBASE_SERVICE_ACCOUNT_PATH to a mounted secret instead.",
      );
    }
    return JSON.parse(json);
  }

  throw new Error(
    "No Firebase credential configured. Set FIREBASE_SERVICE_ACCOUNT_PATH " +
      "(production) or FIREBASE_SERVICE_ACCOUNT_JSON (development only).",
  );
}

let cachedApp: App | null = null;

/** Lazily initializes (once) and returns the Firebase Admin app used to send pushes. */
export function getFirebaseApp(): App {
  if (cachedApp) return cachedApp;
  const existing = getApps()[0];
  if (existing) {
    cachedApp = existing;
    return existing;
  }
  cachedApp = initializeApp({ credential: cert(loadServiceAccount()) });
  return cachedApp;
}
