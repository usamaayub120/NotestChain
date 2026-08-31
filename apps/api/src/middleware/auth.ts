import type { NextFunction, Request, Response } from "express";
import { hasPermission, Permission, Role, StaffRole, type StaffRole as StaffRoleType } from "@noteschain/shared";
import { prisma } from "../lib/prisma.js";
import { Errors } from "../lib/apiError.js";
import { asyncHandler } from "../lib/http.js";
import { SESSION_COOKIE_NAME } from "../config/security.js";
import { validateSession } from "../modules/auth/session.service.js";

/**
 * Temporary projection for records created before additive staff roles. This
 * keeps the deployment backward compatible while every authorization decision
 * is made with permissions, never a role rank.
 */
function legacyRoles(role: Role): StaffRoleType[] {
  // Legacy ADMIN was a role ladder with every moderator capability too.
  // Preserve that access while new accounts use additive staff assignments.
  if (role === Role.ADMIN) return [StaffRole.PLATFORM_ADMIN, StaffRole.MODERATOR];
  if (role === Role.MODERATOR) return [StaffRole.MODERATOR];
  return [];
}

async function resolveAuth(req: Request) {
  const authorization = req.get("authorization");
  const bearerToken = authorization?.match(/^Bearer\s+(.+)$/i)?.[1];
  const token = bearerToken ?? req.cookies?.[SESSION_COOKIE_NAME];
  if (!token) return undefined;

  const validated = await validateSession(token);
  if (!validated) return undefined;
  if (bearerToken ? validated.transport !== "MOBILE" : validated.transport !== "WEB") return undefined;

  const user = await prisma.user.findUnique({
    where: { id: validated.userId },
    include: { staffRoles: { select: { role: true } } },
  });
  if (!user || user.status !== "ACTIVE") return undefined;

  return {
    userId: user.id,
    role: user.role as Role,
    roles: Array.from(new Set([...legacyRoles(user.role as Role), ...user.staffRoles.map((assignment) => assignment.role as StaffRoleType)])),
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

/** @deprecated Use requirePermission; retained for older call-sites during migration. */
export function requireRole(minRole: Role) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.auth) return next(Errors.unauthorized());
    const permission = minRole === Role.ADMIN ? Permission.MANAGE_PLATFORM : Permission.MODERATE_CONTENT;
    if (!hasPermission(req.auth.roles, permission)) return next(Errors.forbidden());
    next();
  };
}

export function requirePermission(permission: Permission) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.auth) return next(Errors.unauthorized());
    if (!hasPermission(req.auth.roles, permission)) return next(Errors.forbidden());
    next();
  };
}

export function requireAnyPermission(...permissions: Permission[]) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.auth) return next(Errors.unauthorized());
    if (!permissions.some((permission) => hasPermission(req.auth!.roles, permission))) return next(Errors.forbidden());
    next();
  };
}
