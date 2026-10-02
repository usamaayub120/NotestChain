/**
 * Mirrors packages/shared/src/limits.ts, which is the source of truth. Kept
 * as literals because the mobile workspace deliberately has no dependency on
 * @noteschain/* yet -  the same arrangement as `appName` in config.ts and
 * `REASON_MAX` in report-dialog.tsx.
 *
 * None of these numbers reached the editor before. It rendered a bare
 * "N characters" against no limit at all, so a writer passed 20,000
 * characters, kept seeing a cheerful save state, tapped Submit, and got a raw
 * server validation string back with no indication of where the problem was
 * or how much to cut. apps/web has surfaced all of it since it shipped.
 */
export const LIMITS = {
  TITLE_MAX_BYTES: 100,
  NOTE_BODY_MAX_CHARS: 20_000,
  TAG_MAX_LENGTH: 24,
  MAX_TAGS_PER_PUBLICATION: 5,
} as const;

export function utf8ByteLength(value: string): number {
  // A title is byte-limited because it is stored inside a fixed-size Solana
  // account, so an emoji genuinely costs four of them.
  let bytes = 0;
  for (const char of value) {
    const code = char.codePointAt(0)!;
    if (code < 0x80) bytes += 1;
    else if (code < 0x800) bytes += 2;
    else if (code < 0x10000) bytes += 3;
    else bytes += 4;
  }
  return bytes;
}

/**
 * Counts by code point, not UTF-16 code unit, so an emoji counts as one.
 * `"🌊".length` is 2, which would charge a writer double for every emoji and
 * make the counter disagree with what they can see.
 */
export function characterLength(value: string): number {
  let count = 0;
  for (const _ of value) count += 1;
  return count;
}

/**
 * How many characters must come off the end to get back under `maxChars`.
 * The point is to be able to say "remove 9 characters" rather than
 * "too long" -  a number a writer can act on without counting anything.
 */
export function charactersOverLimit(value: string, maxChars: number): number {
  const length = characterLength(value);
  return length > maxChars ? length - maxChars : 0;
}

export interface TagProblem {
  message: string;
}

/** Validates the comma-separated tag field against the publication rules. */
export function validateTags(tags: string[]): TagProblem | null {
  if (tags.length > LIMITS.MAX_TAGS_PER_PUBLICATION) {
    return { message: `Up to ${LIMITS.MAX_TAGS_PER_PUBLICATION} tags. Remove ${tags.length - LIMITS.MAX_TAGS_PER_PUBLICATION}.` };
  }
  const tooLong = tags.find((tag) => tag.length > LIMITS.TAG_MAX_LENGTH);
  if (tooLong) {
    return { message: `"${tooLong}" is too long. Tags are up to ${LIMITS.TAG_MAX_LENGTH} characters.` };
  }
  return null;
}
