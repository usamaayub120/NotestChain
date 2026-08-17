import { createHash } from "node:crypto";

// Record-separator control char (0x1E) — deliberately not something that can
// occur in a title/body typed by a user, so the two fields can't collide
// across the boundary (e.g. title "a" + content "bc" vs title "ab" + content "c").
const FIELD_SEPARATOR = String.fromCharCode(0x1e);

/**
 * FROZEN — v1 publications only. Do not rename, do not change, do not add
 * parameters. Every Publication account written before the v2 schema was
 * hashed with exactly this function, and their digests are immutable on
 * chain. New notes use computeContentHashV2 below.
 *
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

// ─── v2 ──────────────────────────────────────────────────────────────────

/**
 * Domain tag. Without it, a v1 note whose content happened to be
 * `excerpt\x1Ebody` could produce a digest colliding with a v2 note.
 * Contrived, but this is a permanent public record — 17 bytes is cheap.
 */
const V2_DOMAIN = "noteschain/pub/v2";

function lengthPrefixed(value: string): Buffer {
  const bytes = Buffer.from(value, "utf8");
  const length = Buffer.alloc(4);
  length.writeUInt32LE(bytes.length);
  return Buffer.concat([length, bytes]);
}

/**
 * Content hash for v2 publications, where the body lives in Postgres and only
 * this digest goes on-chain.
 *
 *   sha256( "noteschain/pub/v2"
 *         || u32le(len(title))   || title
 *         || u32le(len(excerpt)) || excerpt
 *         || u32le(len(content)) || content )
 *
 * Length-prefixed rather than separator-delimited. v1's bare 0x1E separator
 * was unambiguous when a body was 600 bytes of typed text; it is not safe for
 * a 20,000-character pasted body, which can contain 0x1E and make the
 * preimage ambiguous. u32le prefixes are unambiguous for any byte sequence
 * and match Borsh's own String encoding, so a Rust reimplementation is
 * mechanical.
 *
 * The excerpt is inside the preimage deliberately: it is what makes a v2
 * account a complete attested record rather than a verified digest sitting
 * next to an unverifiable blurb. It also means the excerpt is PERMANENT and
 * must never be recomputed for an already-published row.
 *
 * No normalisation happens here. Normalise once at submit before storing,
 * then hash exactly the stored bytes — otherwise verification becomes
 * environment-dependent and a dependency bump can silently stop old notes
 * verifying.
 */
export function computeContentHashV2(title: string, excerpt: string, content: string): Buffer {
  return createHash("sha256")
    .update(Buffer.concat([Buffer.from(V2_DOMAIN, "ascii"), lengthPrefixed(title), lengthPrefixed(excerpt), lengthPrefixed(content)]))
    .digest();
}

export function contentHashV2Hex(title: string, excerpt: string, content: string): string {
  return computeContentHashV2(title, excerpt, content).toString("hex");
}
