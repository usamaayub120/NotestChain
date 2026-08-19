import type { NextFunction, Request, Response } from "express";
import type { Role } from "@noteschain/shared";
import { prisma } from "../lib/prisma.js";
import { Errors } from "../lib/apiError.js";
import { asyncHandler } from "../lib/http.js";
import { SESSION_COOKIE_NAME } from "../config/security.js";
import { validateSession } from "../modules/auth/session.service.js";

const ROLE_RANK: Record<Role, number> = { USER: 0, MODERATOR: 1, ADMIN: 2 };

async function resolveAuth(req: Request) {
  const authorization = req.get("authorization");
  const bearerToken = authorization?.match(/^Bearer\s+(.+)$/i)?.[1];
  const token = bearerToken ?? req.cookies?.[SESSION_COOKIE_NAME];
  if (!token) return undefined;

  const validated = await validateSession(token);
  if (!validated) return undefined;
  if (bearerToken ? validated.transport !== "MOBILE" : validated.transport !== "WEB") return undefined;

  const user = await prisma.user.findUnique({ where: { id: validated.userId } });
  if (!user || user.status !== "ACTIVE") return undefined;

  return {
    userId: user.id,
    role: user.role as Role,
    sessionId: validated.sessionId,
    csrfToken: validated.csrfToken,
    transport: validated.transport,
  };
}

/** Populates req.auth when a valid session cookie is present; never rejects. */
export const attachAuth = asyncHandler(async (req, _res, next) => {
  req.auth = await resolveAuth(req);
  next();
});

export function requireAuth(req: Request, _res: Response, next: NextFunction) {
  if (!req.auth) return next(Errors.unauthorized());
  next();
}

export function requireRole(minRole: Role) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.auth) return next(Errors.unauthorized());
    if (ROLE_RANK[req.auth.role] < ROLE_RANK[minRole]) return next(Errors.forbidden());
    next();
  };
}
