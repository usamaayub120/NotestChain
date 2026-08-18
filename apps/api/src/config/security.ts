// Central place for auth/session tuning — see ARCHITECTURE.md §3.2/§3.3.

// OWASP minimum baseline for Argon2id; raise memoryCost if host resources
// allow. `type` is intentionally not set here — call sites pass
// `type: argon2.argon2id` explicitly alongside this spread.
export const ARGON2_OPTIONS = {
  memoryCost: 19_456, // ~19 MiB
  timeCost: 2,
  parallelism: 1,
} as const;

export const SESSION_COOKIE_NAME = "nc_session";
export const CSRF_COOKIE_NAME = "nc_csrf";
export const VISITOR_COOKIE_NAME = "nc_visitor";
export const CSRF_HEADER_NAME = "x-csrf-token";

export const SESSION_IDLE_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days
export const SESSION_ABSOLUTE_TTL_MS = 90 * 24 * 60 * 60 * 1000; // 90 days
export const VISITOR_COOKIE_TTL_MS = 365 * 24 * 60 * 60 * 1000; // 1 year
