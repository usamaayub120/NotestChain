import { describe, expect, it } from "vitest";
import { isValidUsername, slugifyUsername, usernameFromEmail, withUsernameSuffix } from "./username.js";
import { LIMITS } from "./limits.js";

describe("slugifyUsername", () => {
  it("lowercases and replaces runs of invalid characters with one dash", () => {
    expect(slugifyUsername("Marguerite Vale")).toBe("marguerite-vale");
    expect(slugifyUsername("a...b")).toBe("a-b");
  });

  it("folds accents rather than dropping the letter", () => {
    expect(slugifyUsername("renée")).toBe("renee");
  });

  it("never starts or ends with a separator", () => {
    expect(slugifyUsername("__nightwire__")).toBe("nightwire");
    expect(slugifyUsername("-hello-")).toBe("hello");
  });

  it("stays inside the length limit", () => {
    const slug = slugifyUsername("x".repeat(200));
    expect(slug).not.toBeNull();
    expect(slug!.length).toBeLessThanOrEqual(LIMITS.USERNAME_MAX_LENGTH);
  });

  it("returns null when nothing usable survives", () => {
    // Callers pick the fallback; generating one here would hide the problem.
    expect(slugifyUsername("!!!")).toBeNull();
    expect(slugifyUsername("ab")).toBeNull(); // under USERNAME_MIN_LENGTH
    expect(slugifyUsername("")).toBeNull();
  });

  it("always produces something usernameSchema would accept", () => {
    for (const input of ["Marguerite Vale", "renée", "__nightwire__", "a...b", "x".repeat(200)]) {
      const slug = slugifyUsername(input);
      expect(slug === null || isValidUsername(slug)).toBe(true);
    }
  });
});

describe("usernameFromEmail", () => {
  it("uses only the local part, never the mail provider", () => {
    expect(usernameFromEmail("marguerite.vale@example.com")).toBe("marguerite-vale");
  });

  it("returns null when the local part has nothing usable", () => {
    expect(usernameFromEmail("!!@example.com")).toBeNull();
  });
});

describe("withUsernameSuffix", () => {
  it("appends the suffix", () => {
    expect(withUsernameSuffix("nightwire", "2")).toBe("nightwire-2");
  });

  it("trims the base so the result still fits the limit", () => {
    const result = withUsernameSuffix("x".repeat(LIMITS.USERNAME_MAX_LENGTH), "1234");
    expect(result.length).toBeLessThanOrEqual(LIMITS.USERNAME_MAX_LENGTH);
    expect(result.endsWith("-1234")).toBe(true);
    expect(isValidUsername(result)).toBe(true);
  });
});
