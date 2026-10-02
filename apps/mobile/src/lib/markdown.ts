/**
 * Mirrors the inline parser in packages/shared/src/markdown.ts, which is the
 * source of truth. Same arrangement as limits.ts, labels.ts and
 * kept-state.ts: the mobile workspace deliberately has no dependency on
 * @noteschain/*. markdown.test.ts compares this against that file's
 * behaviour so the two cannot drift apart silently.
 *
 * The reader rendered `note.content` inside a plain <Text>, so a note
 * written on the web arrived with its `**bold**` and `==highlight==` showing
 * as literal asterisks and equals signs. Note that the supported subset is
 * deliberately small -  three inline marks, no headings, no links, no code,
 * no images, for the reasons that file documents -  so `## Heading` really
 * is literal text in this format, and always was.
 */
export const MARKS = ["strong", "em", "mark"] as const;
export type MarkKind = (typeof MARKS)[number];

export type InlineNode = { type: "text"; value: string } | { type: MarkKind; children: InlineNode[] };

export interface Paragraph {
  type: "paragraph";
  children: InlineNode[];
}

const MAX_DEPTH = 3;

/** Longest delimiter first -  `**` must be tried before `*`. */
const DELIMITERS: ReadonlyArray<{ marker: string; type: MarkKind }> = [
  { marker: "**", type: "strong" },
  { marker: "==", type: "mark" },
  { marker: "*", type: "em" },
];

const ESCAPABLE = new Set(["*", "=", "\\"]);

function isWhitespace(ch: string | undefined): boolean {
  return ch === undefined || /\s/.test(ch);
}

/** Simplified CommonMark flanking: leaves `2 * 3 * 4` alone. */
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

/** Unmatched delimiters render literally: `**hello` stays `**hello`. */
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
      depth < MAX_DEPTH
        ? DELIMITERS.find((d) => src.startsWith(d.marker, i) && canOpen(src, i, d.marker.length))
        : undefined;

    if (delimiter) {
      const contentStart = i + delimiter.marker.length;
      const closing = findClosing(src, contentStart, delimiter.marker);
      if (closing !== -1) {
        flush();
        nodes.push({ type: delimiter.type, children: parseInline(src.slice(contentStart, closing), depth + 1) });
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
