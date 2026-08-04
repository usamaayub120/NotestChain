import { Router } from "express";
import { loginSchema, registerSchema } from "@noteschain/validation";
import { asyncHandler, ok } from "../../lib/http.js";
import { Errors } from "../../lib/apiError.js";
import { prisma } from "../../lib/prisma.js";
import { authRateLimit } from "../../middleware/rateLimit.js";
import { requireAuth } from "../../middleware/auth.js";
import { recordAudit } from "../../lib/audit.js";
import { AuthError, authenticateUser, registerUser, toPublicUser } from "./auth.service.js";
import { createSession, refreshSession, revokeSession } from "./session.service.js";
import { clearSessionCookies, setSessionCookies } from "./cookies.js";

export const authRouter = Router();

authRouter.post(
  "/register",
  authRateLimit,
  asyncHandler(async (req, res) => {
    const input = registerSchema.parse(req.body);
    const user = await registerUser(input.email, input.password);
    const session = await createSession(user.id, req);
    setSessionCookies(res, session);
    await recordAudit({ actorUserId: user.id, action: "USER_REGISTERED", ipAddress: req.ip });
    return ok(res, { user: toPublicUser(user) }, 201);
  }),
);

authRouter.post(
  "/login",
  authRateLimit,
  asyncHandler(async (req, res) => {
    const input = loginSchema.parse(req.body);
    try {
      const user = await authenticateUser(input.email, input.password);
      const session = await createSession(user.id, req);
      setSessionCookies(res, session);
      await recordAudit({ actorUserId: user.id, action: "LOGIN_SUCCESS", ipAddress: req.ip });
      return ok(res, { user: toPublicUser(user) });
    } catch (err) {
      if (err instanceof AuthError) {
        await recordAudit({
          action: "LOGIN_FAILURE",
          metadata: { email: input.email },
          ipAddress: req.ip,
        });
      }
      throw err;
    }
  }),
);

authRouter.post(
  "/logout",
  asyncHandler(async (req, res) => {
    if (req.auth) {
      await revokeSession(req.auth.sessionId);
      await recordAudit({ actorUserId: req.auth.userId, action: "LOGOUT", ipAddress: req.ip });
    }
    clearSessionCookies(res);
    return ok(res, { success: true });
  }),
);

authRouter.post(
  "/refresh",
  asyncHandler(async (req, res) => {
    if (!req.auth) throw Errors.unauthorized();
    const refreshed = await refreshSession(req.auth.sessionId, req);
    if (!refreshed) {
      clearSessionCookies(res);
      throw Errors.unauthorized("Session expired. Please sign in again.");
    }
    setSessionCookies(res, refreshed);
    return ok(res, { success: true });
  }),
);

authRouter.get(
  "/me",
  requireAuth,
  asyncHandler(async (req, res) => {
    const user = await prisma.user.findUniqueOrThrow({ where: { id: req.auth!.userId } });
    return ok(res, { user: toPublicUser(user) });
  }),
);
