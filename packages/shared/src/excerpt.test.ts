import { describe, expect, it } from "vitest";
import { computeExcerpt } from "./excerpt.js";
import { LIMITS, utf8ByteLength } from "./limits.js";

describe("computeExcerpt", () => {
  it("returns short content unchanged and without an ellipsis", () => {
    expect(computeExcerpt("A short thought.")).toBe("A short thought.");
  });

  it("strips markup rather than slicing through it", () => {
    expect(computeExcerpt("**bold** and *italic* and ==shimmer==")).toBe("bold and italic and shimmer");
  });

  it("collapses newlines so the excerpt is a single line", () => {
    expect(computeExcerpt("one\n\ntwo\nthree")).toBe("one two three");
  });

  it("is empty for empty or markup-only input", () => {
    expect(computeExcerpt("")).toBe("");
    expect(computeExcerpt("   \n\n  ")).toBe("");
  });

  describe("never produces a broken character", () => {
    // This is the case that matters most: from the v2 schema on, the excerpt
    // is inside the content-hash preimage, so a mangled character here is
    // hashed onto the chain permanently with no way to correct it.
    it("does not split a surrogate pair", () => {
      const excerpt = computeExcerpt("🌊".repeat(400));
      expect(excerpt).not.toMatch(/�/);
      // No lone surrogates anywhere.
      for (const unit of excerpt) {
        const code = unit.codePointAt(0)!;
        expect(code >= 0xd800 && code <= 0xdfff).toBe(false);
      }
    });

    it("always cuts on a grapheme-cluster boundary", () => {
      // The property that actually matters. Asserting "doesn't end in a
      // combining mark" would be wrong: an intact e + U+0301 cluster
      // legitimately ends with one. What must hold is that the excerpt is
      // the source truncated at a cluster boundary, never mid-cluster.
      const segmenter = new Intl.Segmenter(undefined, { granularity: "grapheme" });

      for (const source of [
        "e\u0301".repeat(400), // combining acute
        "\u{1F469}\u200D\u{1F4BB}".repeat(200), // ZWJ sequence
        "\u{1F1EE}\u{1F1F3}".repeat(200), // regional-indicator pair
        "\u{1F44D}\u{1F3FD}".repeat(200), // skin-tone modifier
      ]) {
        const excerpt = computeExcerpt(source);
        const body = excerpt.endsWith("\u2026") ? excerpt.slice(0, -1) : excerpt;

        const boundaries = new Set([""]);
        let accumulated = "";
        for (const { segment } of segmenter.segment(source)) {
          accumulated += segment;
          boundaries.add(accumulated);
          boundaries.add(accumulated.trimEnd());
        }

        expect(boundaries.has(body)).toBe(true);
      }
    });
  });

  describe("byte budget", () => {
    it("fits the on-chain field for plain ASCII", () => {
      const excerpt = computeExcerpt("word ".repeat(500));
      expect(utf8ByteLength(excerpt)).toBeLessThanOrEqual(LIMITS.EXCERPT_MAX_BYTES);
    });

    it("fits the on-chain field for all-emoji content", () => {
      // The old character-capped implementation would have produced 200
      // graphemes = 800 bytes against a 280-byte field.
      const excerpt = computeExcerpt("🌊".repeat(400));
      expect(utf8ByteLength(excerpt)).toBeLessThanOrEqual(LIMITS.EXCERPT_MAX_BYTES);
    });

    it("fits the on-chain field for CJK content", () => {
      const excerpt = computeExcerpt("今日は良い天気です".repeat(60));
      expect(utf8ByteLength(excerpt)).toBeLessThanOrEqual(LIMITS.EXCERPT_MAX_BYTES);
    });

    it("counts the ellipsis against the budget", () => {
      // "…" is 3 bytes in UTF-8 and is part of the stored value.
      const excerpt = computeExcerpt("a".repeat(5000));
      expect(excerpt.endsWith("…")).toBe(true);
      expect(utf8ByteLength(excerpt)).toBeLessThanOrEqual(LIMITS.EXCERPT_MAX_BYTES);
    });
  });

  it("prefers a word boundary when truncating", () => {
    const excerpt = computeExcerpt("alpha bravo charlie delta echo foxtrot ".repeat(20));
    expect(excerpt.endsWith("…")).toBe(true);
    expect(excerpt).not.toMatch(/ …$/);
    // Should not end mid-word before the ellipsis.
    expect(excerpt.slice(0, -1)).toMatch(/(alpha|bravo|charlie|delta|echo|foxtrot)$/);
  });

  it("is deterministic, since the result is hashed", () => {
    const source = "**A note** that runs on ".repeat(50);
    expect(computeExcerpt(source)).toBe(computeExcerpt(source));
  });
});
