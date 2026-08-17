import { describe, expect, it } from "vitest";
import { countWords, markdownToPlainText, normalizeContent, parseInline, parseNoteMarkdown } from "./markdown.js";
import type { InlineNode } from "./markdown.js";

/** Compact rendering of the token tree, so assertions stay readable. */
function sketch(nodes: InlineNode[]): string {
  return nodes
    .map((node) => (node.type === "text" ? node.value : `<${node.type}>${sketch(node.children)}</${node.type}>`))
    .join("");
}

const inline = (src: string) => sketch(parseInline(src));

describe("marks", () => {
  it("parses the four supported marks", () => {
    expect(inline("**bold**")).toBe("<strong>bold</strong>");
    expect(inline("*italic*")).toBe("<em>italic</em>");
    expect(inline("==shimmer==")).toBe("<mark>shimmer</mark>");
  });

  it("prefers ** over * so bold never parses as nested italics", () => {
    expect(inline("**bold**")).not.toContain("<em>");
  });

  it("nests marks", () => {
    expect(inline("**bold with *italic* inside**")).toBe("<strong>bold with <em>italic</em> inside</strong>");
    expect(inline("==**both**==")).toBe("<mark><strong>both</strong></mark>");
  });

  it("handles marks mid-sentence and after opening punctuation", () => {
    expect(inline("a **b** c")).toBe("a <strong>b</strong> c");
    expect(inline("(**b**)")).toBe("(<strong>b</strong>)");
    expect(inline('"**b**"')).toBe('"<strong>b</strong>"');
    expect(inline("**b**, then")).toBe("<strong>b</strong>, then");
  });

  // Deliberately stricter than CommonMark, which allows intra-word `*`
  // emphasis and splits delimiter runs. An opener here must follow
  // whitespace or opening punctuation.
  //
  // The asymmetry is the point. A false negative shows literal asterisks —
  // visible in the Preview tab, fixable before publishing. A false positive
  // silently italicises part of a note that is about to be hashed and made
  // permanent. Given only one of those is correctable, we take the visible
  // failure every time.
  it("leaves intra-word and run-adjacent markers literal", () => {
    expect(inline("**a****b**")).toBe("<strong>a</strong>**b**");
    expect(inline("un**bold**ing")).toBe("un**bold**ing");
  });
});

describe("never swallowing the writer's characters", () => {
  it("renders unmatched markers literally", () => {
    expect(inline("**hello")).toBe("**hello");
    expect(inline("==oops")).toBe("==oops");
    expect(inline("a * b")).toBe("a * b");
  });

  it("leaves arithmetic alone (flanking rules)", () => {
    expect(inline("2 * 3 * 4")).toBe("2 * 3 * 4");
    expect(inline("5*6")).toBe("5*6");
  });

  it("does not treat a closer preceded by whitespace as a closer", () => {
    expect(inline("*not emphasis *")).toBe("*not emphasis *");
  });

  it("supports escapes", () => {
    expect(inline("\\*literal\\*")).toBe("*literal*");
    expect(inline("\\=\\=literal\\=\\=")).toBe("==literal==");
    expect(inline("a \\\\ b")).toBe("a \\ b");
  });

  it("stops nesting at the depth guard instead of recursing without bound", () => {
    const deep = "*".repeat(40) + "x" + "*".repeat(40);
    expect(() => parseInline(deep)).not.toThrow();
    expect(inline(deep)).toContain("x");
  });

  it("terminates on long runs of bare delimiters", () => {
    for (const src of ["*".repeat(500), "=".repeat(500), "**".repeat(250)]) {
      expect(() => parseInline(src)).not.toThrow();
    }
  });
});

describe("markup is never HTML", () => {
  // The parser emits a token tree with no HTML anywhere, so these are just
  // text. This is the property that makes dangerouslySetInnerHTML
  // unnecessary at the render layer.
  it.each([
    "<script>alert(1)</script>",
    '<img src=x onerror="alert(1)">',
    "[click](javascript:alert(1))",
    "<iframe src=//evil></iframe>",
    "&lt;script&gt;",
    "<a href='#' onclick='x'>link</a>",
  ])("keeps %s as plain text", (payload) => {
    const nodes = parseInline(payload);
    expect(nodes).toEqual([{ type: "text", value: payload }]);
    expect(markdownToPlainText(payload)).toBe(payload);
  });

  it("produces only text and the three known mark types", () => {
    const walk = (nodes: InlineNode[]): string[] =>
      nodes.flatMap((n) => (n.type === "text" ? [n.type] : [n.type, ...walk(n.children)]));
    const types = new Set(walk(parseInline("**a** *b* ==c== <script>d</script>")));
    expect([...types].sort()).toEqual(["em", "mark", "strong", "text"]);
  });
});

describe("blocks", () => {
  it("splits paragraphs on blank lines and keeps single newlines inside", () => {
    const blocks = parseNoteMarkdown("one\nstill one\n\ntwo");
    expect(blocks).toHaveLength(2);
    expect(sketch(blocks[0]!.children)).toBe("one\nstill one");
    expect(sketch(blocks[1]!.children)).toBe("two");
  });

  it("drops empty blocks from runs of blank lines", () => {
    expect(parseNoteMarkdown("a\n\n\n\n\nb")).toHaveLength(2);
    expect(parseNoteMarkdown("   \n\n  ")).toHaveLength(0);
  });
});

describe("markdownToPlainText", () => {
  it("strips markers", () => {
    expect(markdownToPlainText("**bold** and *italic* and ==shimmer==")).toBe("bold and italic and shimmer");
  });

  it("keeps emoji intact", () => {
    expect(markdownToPlainText("**hello** 🌊👋")).toBe("hello 🌊👋");
  });

  it("resolves escapes so the index sees real characters", () => {
    expect(markdownToPlainText("\\*not bold\\*")).toBe("*not bold*");
  });
});

describe("countWords", () => {
  it("counts across markers rather than around them", () => {
    expect(countWords("**hello**")).toBe(1);
    expect(countWords("the *quick* brown ==fox==")).toBe(4);
  });

  it("is zero for empty and marker-only input", () => {
    expect(countWords("")).toBe(0);
    expect(countWords("   \n\n  ")).toBe(0);
  });

  it("does not report 1 for CJK text", () => {
    // The regex fallback would return 1 here; the whole reason for
    // Intl.Segmenter is that a byte/length limit hits these writers hardest.
    expect(countWords("今日は良い天気です")).toBeGreaterThan(1);
  });
});

describe("normalizeContent", () => {
  it("normalises line endings", () => {
    expect(normalizeContent("a\r\nb\rc")).toBe("a\nb\nc");
  });

  it("strips NUL, which Postgres TEXT rejects outright", () => {
    expect(normalizeContent("a\u0000b")).toBe("ab");
  });

  it("strips U+001E, v1's hash separator, which is typeable", () => {
    expect(normalizeContent("a\u001Eb")).toBe("ab");
  });

  it("keeps tabs and newlines", () => {
    expect(normalizeContent("a\tb\nc")).toBe("a\tb\nc");
  });

  it("applies NFC so the same visible text hashes the same way", () => {
    const decomposed = "e\u0301"; // e + combining acute
    expect(normalizeContent(decomposed)).toBe("é");
  });

  it("trims surrounding whitespace", () => {
    expect(normalizeContent("  hi  ")).toBe("hi");
  });
});
