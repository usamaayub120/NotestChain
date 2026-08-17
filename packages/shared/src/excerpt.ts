import { LIMITS, utf8ByteLength } from "./limits.js";
import { markdownToPlainText } from "./markdown.js";

/**
 * Splits into grapheme clusters, so an emoji, a flag, or a combining sequence
 * counts as one unit and can never be cut in half.
 *
 * This matters more than it looks. From the v2 publication schema onward the
 * excerpt is inside the content-hash preimage, which means it is permanent.
 * The previous implementation did `content.slice(0, 140)` on UTF-16 code
 * units — slicing between the two halves of a surrogate pair yields a lone
 * surrogate that renders as a replacement character, and that would be
 * hashed onto the chain forever with no way to correct it.
 */
function graphemes(value: string): string[] {
  const Segmenter = (Intl as { Segmenter?: typeof Intl.Segmenter }).Segmenter;
  if (!Segmenter) return Array.from(value); // code points: still never splits a pair
  return Array.from(new Segmenter(undefined, { granularity: "grapheme" }).segment(value), (s) => s.segment);
}

/** Trims to a whole word where one is close enough to the end to be worth it. */
function trimToWordBoundary(value: string): string {
  const lastSpace = value.lastIndexOf(" ");
  if (lastSpace > value.length * 0.6) return value.slice(0, lastSpace);
  return value;
}

/**
 * Builds the excerpt from the plaintext projection rather than the markdown
 * source, which removes the "cuts mid-syntax" problem entirely — there is no
 * syntax left to cut.
 *
 * Grapheme-capped first, then byte-capped, because the on-chain field is
 * measured in bytes: 200 emoji is 800 bytes against a 280-byte field.
 */
export function computeExcerpt(
  content: string,
  {
    targetGraphemes = LIMITS.EXCERPT_TARGET_GRAPHEMES,
    maxBytes = LIMITS.EXCERPT_MAX_BYTES,
  }: { targetGraphemes?: number; maxBytes?: number } = {},
): string {
  const plain = markdownToPlainText(content).replace(/\s+/g, " ").trim();
  if (!plain) return "";

  const clusters = graphemes(plain);
  let truncated = clusters.length > targetGraphemes;
  let out = truncated ? trimToWordBoundary(clusters.slice(0, targetGraphemes).join("")) : plain;

  // The ellipsis is part of the stored value, so it has to fit inside the
  // byte budget too — drop clusters until the whole thing fits.
  while (utf8ByteLength(truncated ? `${out}…` : out) > maxBytes) {
    const remaining = graphemes(out);
    remaining.pop();
    out = remaining.join("").trimEnd();
    truncated = true;
    if (!out) return "";
  }

  return truncated ? `${out}…` : out;
}
