import { readFileSync } from "node:fs";
import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getAppCheck } from "firebase-admin/app-check";
import { env } from "../../config/env.js";
import { Errors } from "../../lib/apiError.js";

function app() {
  const existing = getApps()[0]; if (existing) return existing;
  if (!env.FIREBASE_SERVICE_ACCOUNT_PATH) throw Errors.serviceUnavailable("Notification registration is not configured.");
  return initializeApp({ credential: cert(JSON.parse(readFileSync(env.FIREBASE_SERVICE_ACCOUNT_PATH, "utf8"))) });
}
export async function verifyAppCheck(token: string | undefined) {
  if (!token) throw Errors.unauthorized("A valid app attestation is required.");
  try { await getAppCheck(app()).verifyToken(token); } catch { throw Errors.unauthorized("Invalid app attestation."); }
}
