import type { Response } from "express";
import { env } from "../../config/env.js";
import {
  CSRF_COOKIE_NAME,
  SESSION_COOKIE_NAME,
  VISITOR_COOKIE_NAME,
  VISITOR_COOKIE_TTL_MS,
} from "../../config/security.js";
import type { IssuedSession } from "./session.service.js";

function baseCookieOptions() {
  return {
    domain: env.COOKIE_DOMAIN,
    secure: env.COOKIE_SECURE || env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
  };
}

export function setSessionCookies(res: Response, session: IssuedSession): void {
  res.cookie(SESSION_COOKIE_NAME, session.token, {
    ...baseCookieOptions(),
    httpOnly: true,
    expires: session.expiresAt,
  });
  // Not HttpOnly — the frontend reads this to echo it back in X-CSRF-Token.
  res.cookie(CSRF_COOKIE_NAME, session.csrfToken, {
    ...baseCookieOptions(),
    httpOnly: false,
    expires: session.expiresAt,
  });
}

export function clearSessionCookies(res: Response): void {
  const opts = baseCookieOptions();
  res.clearCookie(SESSION_COOKIE_NAME, opts);
  res.clearCookie(CSRF_COOKIE_NAME, opts);
}

/**
 * A random, HTTP-only first-party identifier used only to de-duplicate
 * publication readers. The database receives a one-way hash, never this
 * token, so analytics cannot be used to reconstruct a browser identifier.
 */
export function setVisitorCookie(res: Response, token: string): void {
  res.cookie(VISITOR_COOKIE_NAME, token, {
    ...baseCookieOptions(),
    httpOnly: true,
    maxAge: VISITOR_COOKIE_TTL_MS,
  });
}
