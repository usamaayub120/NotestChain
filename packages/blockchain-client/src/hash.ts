import { createHash } from "node:crypto";

// Record-separator control char (0x1E) — deliberately not something that can
// occur in a title/body typed by a user, so the two fields can't collide
// across the boundary (e.g. title "a" + content "bc" vs title "ab" + content "c").
const FIELD_SEPARATOR = String.fromCharCode(0x1e);

/**
 * Canonical content hash used both on-chain (Publication.content_hash) and
 * off-chain (Publication.contentHash) so the two can be compared byte for
 * byte during verification. Computed over title + content only — tags,
 * identity, and discoverability are metadata, not "content" for this
 * purpose, and changing them would require a new publication anyway.
 */
export function computeContentHash(title: string, content: string): Buffer {
  return createHash("sha256").update(title + FIELD_SEPARATOR + content, "utf8").digest();
}

export function contentHashHex(title: string, content: string): string {
  return computeContentHash(title, content).toString("hex");
}
