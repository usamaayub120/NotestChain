// The note markup subset, and the only place it is defined.
//
// This is a hand-written parser rather than remark/marked, for three reasons
// specific to this product:
//
//   1. It emits a plain token tree, never an HTML string. The web renderer
//      turns tokens into React elements, so `dangerouslySetInnerHTML` never
//      enters the picture and XSS is structurally impossible rather than
//      filtered out. That is stricter than a sanitizer, not weaker, and it
//      matches the escape-everything-then-allow-list stance already taken in
//      search.service.ts.
//   2. Note bodies are hashed and permanent. A breaking change in a markdown
//      dependency would silently re-render years-old immutable notes. A
//      frozen parser we own cannot.
//   3. The subset is four inline marks. remark + a sanitizer is ~60-80KB
//      gzipped to render that, inside a WebView.
//
// If the subset ever grows to links, reference definitions, lists, or nesting
// past MAX_DEPTH, REPLACE this parser rather than extending it — hand-written
// markdown parsers get dangerous at exactly that boundary.
//
// Deliberately absent, each for a reason rather than by omission:
//   - links   : 20+ bytes of a permanent record pointing at a URL whose
//               destination can be repointed after moderation approves it.
//   - images  : an off-chain URL that rots, and a third-party request that
//               beacons every reader's IP on an anonymity-first product.
//   - code    : DESIGN_SYSTEM.md §4 reserves mono type for hashes, PDAs and
//               signatures, never prose.
//   - headings: the title is the heading.

export const MARKS = ["strong", "em", "mark"] as const;
export type MarkKind = (typeof MARKS)[number];

export type InlineNode =
  | { type: "text"; value: string }
  | { type: MarkKind; children: InlineNode[] };

export interface Paragraph {
  type: "paragraph";
  children: InlineNode[];
}

/** Nesting past this renders as literal text. Guards pathological input. */
const MAX_DEPTH = 3;

/** Longest delimiter first — `**` must be tried before `*`. */
const DELIMITERS: ReadonlyArray<{ marker: string; type: MarkKind }> = [
  { marker: "**", type: "strong" },
  { marker: "==", type: "mark" },
  { marker: "*", type: "em" },
];

const ESCAPABLE = new Set(["*", "=", "\\"]);

function isWhitespace(ch: string | undefined): boolean {
  return ch === undefined || /\s/.test(ch);
}

/**
 * Simplified CommonMark left/right-flanking. This is the difference between
 * a parser that leaves `2 * 3 * 4` alone and one that italicises it.
 */
function canOpen(src: string, start: number, markerLength: number): boolean {
  const before = start > 0 ? src[start - 1] : undefined;
  const after = src[start + markerLength];
  return !isWhitespace(after) && (before === undefined || isWhitespace(before) || /[(["']/.test(before));
}

function canClose(src: string, start: number): boolean {
  return start > 0 && !isWhitespace(src[start - 1]);
}

function findClosing(src: string, from: number, marker: string): number {
  for (let i = from; i <= src.length - marker.length; i += 1) {
    if (src[i] === "\\") {
      i += 1;
      continue;
    }
    if (src.startsWith(marker, i) && canClose(src, i)) return i;
  }
  return -1;
}

/**
 * Parses inline marks. Unmatched delimiters render literally — `**hello`
 * stays `**hello`. Never swallow a writer's characters; that is the same
 * principle as not blocking their keystrokes.
 */
export function parseInline(src: string, depth = 0): InlineNode[] {
  const nodes: InlineNode[] = [];
  let buffer = "";

  const flush = () => {
    if (buffer) {
      nodes.push({ type: "text", value: buffer });
      buffer = "";
    }
  };

  let i = 0;
  while (i < src.length) {
    const ch = src[i]!;

    if (ch === "\\" && ESCAPABLE.has(src[i + 1] ?? "")) {
      buffer += src[i + 1];
      i += 2;
      continue;
    }

    const delimiter =
      depth < MAX_DEPTH ? DELIMITERS.find((d) => src.startsWith(d.marker, i) && canOpen(src, i, d.marker.length)) : undefined;

    if (delimiter) {
      const contentStart = i + delimiter.marker.length;
      const closing = findClosing(src, contentStart, delimiter.marker);
      if (closing !== -1) {
        flush();
        nodes.push({
          type: delimiter.type,
          children: parseInline(src.slice(contentStart, closing), depth + 1),
        });
        i = closing + delimiter.marker.length;
        continue;
      }
    }

    buffer += ch;
    i += 1;
  }

  flush();
  return nodes;
}

/** Blank line separates paragraphs; a single newline stays a line break. */
export function parseNoteMarkdown(source: string): Paragraph[] {
  return source
    .split(/\n{2,}/)
    .map((block) => block.trim())
    .filter((block) => block.length > 0)
    .map((block) => ({ type: "paragraph" as const, children: parseInline(block) }));
}

function collectText(nodes: InlineNode[], out: string[]): void {
  for (const node of nodes) {
    if (node.type === "text") out.push(node.value);
    else collectText(node.children, out);
  }
}

/**
 * The plaintext projection. Used for the search index, `ts_headline`, list
 * previews, excerpts and word counts — everywhere markup would otherwise leak
 * through as literal `**` characters.
 */
export function markdownToPlainText(source: string): string {
  return parseNoteMarkdown(source)
    .map((paragraph) => {
      const parts: string[] = [];
      collectText(paragraph.children, parts);
      return parts.join("");
    })
    .join("\n\n");
}

/**
 * Word count over the plaintext projection, so `**hello**` is one word.
 *
 * Intl.Segmenter rather than a whitespace split: a regex reports "1 word" for
 * a CJK note, which makes the counter useless for exactly the writers a
 * length limit affects most.
 */
export function countWords(source: string): number {
  const text = markdownToPlainText(source).trim();
  if (!text) return 0;

  const Segmenter = (Intl as { Segmenter?: typeof Intl.Segmenter }).Segmenter;
  if (!Segmenter) return text.split(/\s+/).filter(Boolean).length;

  let count = 0;
  for (const segment of new Segmenter(undefined, { granularity: "word" }).segment(text)) {
    if (segment.isWordLike) count += 1;
  }
  return count;
}

/**
 * Normalisation applied once at submit, before storing — never inside the
 * hash function. If normalisation lived in the hash, verification would
 * become environment-dependent and a dependency bump could silently stop old
 * notes verifying.
 *
 * Stripping C0 controls is not cosmetic: Postgres TEXT rejects U+0000
 * outright (SQLSTATE 22021), so a NUL in a pasted body is a 500 today. Tab
 * and newline are kept; the rest of the C0 range and DEL go. That includes
 * U+001E, which was v1's hash field separator and is perfectly typeable.
 */
export function normalizeContent(value: string): string {
  return value
    .replace(/\r\n?/g, "\n")
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "")
    .normalize("NFC")
    .trim();
}
