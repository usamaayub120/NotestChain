import type { NextFunction, Request, Response } from "express";
import { Errors } from "../lib/apiError.js";
import { CSRF_HEADER_NAME } from "../config/security.js";

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

/**
 * Double-submit CSRF check (defense in depth on top of SameSite=Lax cookies
 * — see ARCHITECTURE.md §3.3). Must run after attachAuth so req.auth.csrfToken
 * is available; only enforced on authenticated, state-changing requests.
 */
export function csrfProtection(req: Request, _res: Response, next: NextFunction) {
  if (SAFE_METHODS.has(req.method)) return next();
  if (!req.auth) return next(); // requireAuth (if applicable) runs separately and rejects first
  if (req.auth.transport === "MOBILE") return next();

  const header = req.get(CSRF_HEADER_NAME);
  if (!header || header !== req.auth.csrfToken) {
    return next(Errors.forbidden("Missing or invalid CSRF token."));
  }
  next();
}
