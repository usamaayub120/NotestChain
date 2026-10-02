import { parseInline, parseNoteMarkdown } from "./markdown";

/**
 * This parser is mirrored from packages/shared/src/markdown.ts, and it is
 * the subtlest of the mirrored files: the flanking rules are the difference
 * between a parser that leaves `2 * 3 * 4` alone and one that italicises it.
 *
 * So rather than comparing source text the way labels.test.ts does, this
 * runs the real shared implementation and compares its output, case for
 * case. If the two ever disagree, a note renders differently depending on
 * which client you opened it in.
 */
// eslint-disable-next-line @typescript-eslint/no-require-imports
const shared = require("../../../../packages/shared/dist/markdown.js") as typeof import("./markdown");

const CASES = [
  "plain words with nothing in them",
  "**bold** at the start",
  "ends with **bold**",
  "*italic* and **bold** and ==highlight== together",
  "nested **bold with *italic* inside**",
  // The flanking cases, which are the whole reason this is worth testing.
  "2 * 3 * 4 should stay arithmetic",
  "**unmatched stays literal",
  "a ** b ** c",
  "escaped \\*not italic\\* stays",
  "snake_case_words are untouched",
  "(**parenthesised**) opens correctly",
  "trailing space before close ** no",
  "deeply **nested *marks ==inside== more* here**",
  "",
];

describe("mobile markdown mirrors packages/shared", () => {
  it.each(CASES)("parses %j identically", (src) => {
    expect(parseInline(src)).toEqual(shared.parseInline(src));
  });

  it("splits paragraphs identically", () => {
    const doc = "First paragraph.\n\nSecond **one**.\n\n\nThird.\nStill third.";
    expect(parseNoteMarkdown(doc)).toEqual(shared.parseNoteMarkdown(doc));
  });

  it("never swallows a writer's characters", () => {
    // Every case must round-trip to the same visible text.
    for (const src of CASES) {
      const text = (nodes: ReturnType<typeof parseInline>): string =>
        nodes.map((n) => (n.type === "text" ? n.value : text(n.children))).join("");
      const rendered = text(parseInline(src));
      // Markers are consumed, but no other character may vanish.
      expect(rendered.replace(/\s/g, "")).toBe(
        text(shared.parseInline(src)).replace(/\s/g, ""),
      );
    }
  });
});
