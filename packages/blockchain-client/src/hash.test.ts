import { describe, expect, it } from "vitest";
import { contentHashHex, contentHashV2Hex } from "./hash.js";

// These vectors pin a permanent, on-chain format. If a change to this file
// makes one of them fail, the change is wrong — every publication already
// written was hashed with the current definition and their digests are
// immutable. Regenerating the expected values to make a test pass would
// silently break verification for every existing note.

describe("v1 content hash (frozen)", () => {
  it("matches the pinned vector", () => {
    expect(contentHashHex("Hello", "**Hi** there")).toBe(
      "0e38f88e5ab56fd4f548aea65acccaa997971791161923bb70ff03287c325984",
    );
  });

  it("separates title from content, so fields cannot collide across the boundary", () => {
    expect(contentHashHex("ab", "c")).not.toBe(contentHashHex("a", "bc"));
  });
});

describe("v2 content hash", () => {
  it.each([
    ["Hello", "Hi there", "**Hi** there", "151175638476f45c23231b5b9b8935382eeefb3f6753de1906400db7472ef4d9"],
    ["", "", "", "8af193e2ae9d32983b5fa0d16041d15b5637a0a56644176a79737e3e485b3732"],
    ["Test 🌊", "plain 🌊", "**bold** 🌊 ==shimmer==", "b0a8406e70a7515d88ccae5b8a221f8f5393119c995ec4437971d21c6a921e47"],
  ])("matches the pinned vector for %j / %j", (title, excerpt, content, expected) => {
    expect(contentHashV2Hex(title, excerpt, content)).toBe(expected);
  });

  it("is domain-separated from v1", () => {
    // Without the domain tag a v1 note whose content happened to look like
    // "excerpt<sep>body" could collide with a v2 note.
    expect(contentHashV2Hex("Hello", "", "**Hi** there")).not.toBe(contentHashHex("Hello", "**Hi** there"));
  });

  it("is unambiguous when a field contains the v1 separator byte", () => {
    // The whole reason for length prefixes: a 20,000-character pasted body
    // can contain U+001E, which would make a separator-delimited preimage
    // ambiguous.
    const sep = "\u001E";
    expect(contentHashV2Hex("a", `b${sep}c`, "d")).not.toBe(contentHashV2Hex("a", "b", `c${sep}d`));
  });

  it("distinguishes field boundaries", () => {
    expect(contentHashV2Hex("ab", "c", "d")).not.toBe(contentHashV2Hex("a", "bc", "d"));
    expect(contentHashV2Hex("a", "bc", "d")).not.toBe(contentHashV2Hex("a", "b", "cd"));
  });

  it("covers the excerpt, so an excerpt change invalidates the digest", () => {
    // This is what makes a v2 account a complete attested record rather than
    // a verified digest sitting next to an unverifiable blurb — and why the
    // excerpt must never be recomputed for a published row.
    expect(contentHashV2Hex("t", "one", "body")).not.toBe(contentHashV2Hex("t", "two", "body"));
  });

  it("does not normalise — callers must normalise before storing and hashing", () => {
    expect(contentHashV2Hex("t", "e", "\u00E9")).not.toBe(contentHashV2Hex("t", "e", "e\u0301"));
  });

  it("handles a body far larger than the old 600-byte on-chain limit", () => {
    expect(contentHashV2Hex("t", "e", "x".repeat(20_000))).toMatch(/^[0-9a-f]{64}$/);
  });
});
