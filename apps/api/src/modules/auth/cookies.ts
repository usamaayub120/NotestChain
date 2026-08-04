import type { Response } from "express";
import { env } from "../../config/env.js";
import { CSRF_COOKIE_NAME, SESSION_COOKIE_NAME } from "../../config/security.js";
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
