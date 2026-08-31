import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes } from "node:crypto";
import { readFileSync } from "node:fs";
import { env } from "../../config/env.js";

let cachedKey: Buffer | undefined;
function key(): Buffer {
  if (cachedKey) return cachedKey;
  if (!env.PUSH_TOKEN_ENCRYPTION_KEY_PATH) throw new Error("Push installation storage is not configured.");
  const value = Buffer.from(readFileSync(env.PUSH_TOKEN_ENCRYPTION_KEY_PATH, "utf8").trim(), "base64");
  if (value.length !== 32) throw new Error("Push installation encryption key must be a base64-encoded 32-byte key.");
  cachedKey = value;
  return value;
}
export function hashInstallationCredential(value: string) { return createHash("sha256").update(value).digest("hex"); }
export function lookupPushToken(value: string) { return createHmac("sha256", key()).update(value).digest("hex"); }
export function encryptPushToken(value: string) {
  const iv = randomBytes(12); const cipher = createCipheriv("aes-256-gcm", key(), iv);
  const encrypted = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]); const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, encrypted]).toString("base64");
}
export function decryptPushToken(value: string) {
  const payload = Buffer.from(value, "base64"); const iv = payload.subarray(0, 12); const tag = payload.subarray(12, 28); const encrypted = payload.subarray(28);
  const decipher = createDecipheriv("aes-256-gcm", key(), iv); decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString("utf8");
}
