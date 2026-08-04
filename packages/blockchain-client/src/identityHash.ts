import { createHash } from "node:crypto";

export const ZERO_IDENTITY_HASH = Buffer.alloc(32, 0);

/**
 * Stable one-way reference from an on-chain publication back to an
 * off-chain PublicIdentity, without embedding the raw internal id. Not a
 * secrecy mechanism — the identity's username/display name is already
 * stored alongside it in author_display_snapshot. See ARCHITECTURE.md §3.4.
 */
export function identityReferenceHash(publicIdentityId: string): Buffer {
  return createHash("sha256").update(publicIdentityId, "utf8").digest();
}
