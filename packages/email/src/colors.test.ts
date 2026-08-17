import { describe, expect, it } from "vitest";
import { EMAIL_FONTS } from "./colors.js";

/**
 * Regression test for a real bug: EMAIL_FONTS.body used to be written with
 * double-quoted font names (`"Segoe UI"`), and every use of these constants
 * in layout.ts interpolates them straight into a double-quoted HTML
 * `style="..."` attribute. `"Segoe UI"`'s embedded `"` terminated the
 * attribute early and corrupted every single rendered email — invisible to
 * every "does the output contain this substring" assertion, since the
 * substring itself was still present, just in the wrong place relative to
 * the surrounding markup. Only actually reading the rendered HTML caught it.
 */
describe("font stacks are safe to interpolate into a double-quoted HTML attribute", () => {
  it("EMAIL_FONTS.body contains no double quotes", () => {
    expect(EMAIL_FONTS.body).not.toContain('"');
  });

  it("EMAIL_FONTS.mono contains no double quotes", () => {
    expect(EMAIL_FONTS.mono).not.toContain('"');
  });

  it("still quotes multi-word font names, just with single quotes", () => {
    expect(EMAIL_FONTS.body).toContain("'Segoe UI'");
    expect(EMAIL_FONTS.mono).toContain("'Liberation Mono'");
  });
});
