// Size limits. Two different units on purpose, and the difference matters:
//
//   * BYTES  — for anything still stored inside a Solana account (title,
//     author display, excerpt). The account is a fixed allocation, so the
//     real constraint is UTF-8 length and nothing else will do.
//   * CHARS  — for the note body, which since the v2 publication schema
//     lives in Postgres and never enters a transaction. Nothing about it is
//     byte-constrained any more, and "characters" is the only unit a writer
//     can act on. (An emoji is 4 bytes but 1 character; reporting bytes to a
//     person writing prose was the bug, not a detail of it.)
//
// Byte limits are enforced client-side, API-side (validation package), and
// on-chain (program) — three independent layers, same numbers.
export const LIMITS = {
  TITLE_MAX_BYTES: 100,
  AUTHOR_DISPLAY_MAX_BYTES: 50,

  // The full markdown source of a note. ~4,000 words. Not literally
  // unlimited, and the reasons are real rather than arbitrary: every autosave
  // snapshots a DraftVersion row, the body is tsvector-indexed, and the
  // drafts route caps request bodies at 1mb. 20k chars is at most ~80KB of
  // UTF-8, comfortably inside that, and no writer reaches it by accident.
  NOTE_BODY_MAX_CHARS: 20_000,

  // The ceiling autosave and storage will accept, as opposed to the limit a
  // note must meet to be submitted. These are deliberately different numbers.
  //
  // A writer who runs past NOTE_BODY_MAX_CHARS must not lose the words they
  // already typed — the draft keeps saving, and the editor says plainly that
  // it is too long to submit yet. If autosave enforced the submit limit, going
  // one character over would start failing saves, which is a worse bug than
  // the one being fixed. This ceiling exists only so the request body and the
  // DraftVersion history stay bounded; no honest draft approaches it.
  NOTE_BODY_HARD_MAX_CHARS: 40_000,

  // Stored on-chain inside PublicationV2, and — unlike the v1 excerpt —
  // covered by the content hash, so it is permanent and must never be
  // recomputed for an already-published row.
  EXCERPT_MAX_BYTES: 280,
  EXCERPT_TARGET_GRAPHEMES: 200,

  // Frozen. The v1 on-chain program allocates 4 + 600 bytes for the body and
  // rejects anything longer (programs/.../lib.rs BODY_MAX_BYTES). Kept only
  // so the v1 constant has a name off-chain; no new note is measured against
  // it. Do not reuse this for anything else — it used to double as the
  // comment limit, which is why COMMENT_MAX_BYTES now exists separately.
  BODY_MAX_BYTES_V1: 600,

  COMMENT_MAX_BYTES: 600,

  BIO_MAX_BYTES: 280,
  USERNAME_MIN_LENGTH: 3,
  USERNAME_MAX_LENGTH: 30,
  DISPLAY_NAME_MAX_LENGTH: 60,
  TAG_MAX_LENGTH: 24,
  MAX_TAGS_PER_PUBLICATION: 5,
  MODERATION_NOTE_MAX_LENGTH: 2000,
  REPORT_REASON_MAX_LENGTH: 500,
  UTM_PARAM_MAX_LENGTH: 60,
} as const;

export function utf8ByteLength(value: string): number {
  return new TextEncoder().encode(value).length;
}

export function isWithinByteLimit(value: string, maxBytes: number): boolean {
  return utf8ByteLength(value) <= maxBytes;
}

/**
 * Counts by code point, not UTF-16 code unit — `"🌊".length` is 2, which
 * would charge a writer double for every emoji and make the counter disagree
 * with what they can see.
 */
export function characterLength(value: string): number {
  let count = 0;
  for (const _ of value) count += 1;
  return count;
}

/**
 * How many characters must come off the end to get back under `maxChars`.
 *
 * The point is to be able to say "remove 9 characters" instead of "too long"
 * — that is a number a writer can act on without counting anything
 * themselves. Walks code points from the end so an emoji counts as one.
 */
export function charactersOverLimit(value: string, maxChars: number): number {
  const length = characterLength(value);
  return length > maxChars ? length - maxChars : 0;
}
