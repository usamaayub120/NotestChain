import { LIMITS } from "./limits.js";

/**
 * The rule enforced by usernameSchema in packages/validation/src/identities.ts.
 * Kept here too so username *generation* and username *validation* can never
 * drift into disagreeing about what is acceptable.
 */
const USERNAME_PATTERN = /^[a-z0-9][a-z0-9_-]*$/;

export function isValidUsername(value: string): boolean {
  return (
    value.length >= LIMITS.USERNAME_MIN_LENGTH &&
    value.length <= LIMITS.USERNAME_MAX_LENGTH &&
    USERNAME_PATTERN.test(value)
  );
}

/**
 * Turns arbitrary text into something that satisfies isValidUsername, or
 * returns null when there is nothing usable left (e.g. an all-symbol local
 * part). Callers decide the fallback; this never invents one.
 */
export function slugifyUsername(input: string): string | null {
  const slug = input
    .toLowerCase()
    .normalize("NFKD")
    // Strip the combining marks NFKD just split off, so "renée" becomes
    // "renee" rather than losing the character entirely.
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9_-]+/g, "-")
    .replace(/-{2,}/g, "-")
    // A leading separator is invalid, and a trailing one just looks broken.
    .replace(/^[-_]+/, "")
    .replace(/[-_]+$/, "")
    .slice(0, LIMITS.USERNAME_MAX_LENGTH)
    .replace(/[-_]+$/, "");

  return isValidUsername(slug) ? slug : null;
}

/**
 * A username suggestion derived from an email address. Only the local part is
 * used — the domain is not the person, and including it would leak their mail
 * provider into a public handle.
 */
export function usernameFromEmail(email: string): string | null {
  const localPart = email.split("@")[0] ?? "";
  return slugifyUsername(localPart);
}

/**
 * Appends a disambiguating suffix while staying inside the length limit, for
 * the retry loop that runs when a generated username is already taken.
 * `suffix` is appended as-is, so callers can pass a counter or random text.
 */
export function withUsernameSuffix(base: string, suffix: string): string {
  const separator = "-";
  const room = LIMITS.USERNAME_MAX_LENGTH - suffix.length - separator.length;
  const trimmed = base.slice(0, Math.max(1, room)).replace(/[-_]+$/, "");
  return `${trimmed}${separator}${suffix}`;
}
