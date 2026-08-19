import { Router } from "express";
import { z } from "zod";
import { forgotPasswordSchema, loginSchema, registerSchema, resetPasswordSchema } from "@noteschain/validation";
import { asyncHandler, ok } from "../../lib/http.js";
import { Errors } from "../../lib/apiError.js";
import { prisma } from "../../lib/prisma.js";
import { verifyCaptcha } from "../../lib/captcha.js";
import { authRateLimit } from "../../middleware/rateLimit.js";
import { requireAuth } from "../../middleware/auth.js";
import { recordAudit } from "../../lib/audit.js";
import { AuthError, authenticateUser, registerUser, toPublicUser } from "./auth.service.js";
import { createSession, refreshSession, revokeSession } from "./session.service.js";
import { requestPasswordReset, resetPassword } from "./passwordReset.service.js";
import { clearSessionCookies, setSessionCookies } from "./cookies.js";

export const authRouter = Router();

const mobileDeviceSchema = z.object({
  deviceName: z.string().trim().min(1).max(128).optional(),
});

function mobileSessionPayload(session: Awaited<ReturnType<typeof createSession>>) {
  return { token: session.token, expiresAt: session.expiresAt, transport: session.transport };
}

/** Native sessions deliberately use an opaque bearer token, never a cookie. */
authRouter.post(
  "/mobile/register",
  authRateLimit,
  asyncHandler(async (req, res) => {
    const input = registerSchema.parse(req.body);
    const device = mobileDeviceSchema.parse(req.body);
    const captchaOk = await verifyCaptcha(input.captchaToken, req.ip);
    if (!captchaOk) throw Errors.badRequest("Captcha verification failed. Please try again.");
    const user = await registerUser(input.email, input.password);
    const session = await createSession(user.id, req, { transport: "MOBILE", deviceName: device.deviceName });
    await recordAudit({ actorUserId: user.id, action: "MOBILE_USER_REGISTERED", ipAddress: req.ip });
    return ok(res, { user: toPublicUser(user), session: mobileSessionPayload(session) }, 201);
  }),
);

authRouter.post(
  "/mobile/login",
  authRateLimit,
  asyncHandler(async (req, res) => {
    const input = loginSchema.parse(req.body);
    const device = mobileDeviceSchema.parse(req.body);
    try {
      const user = await authenticateUser(input.email, input.password);
      const session = await createSession(user.id, req, { transport: "MOBILE", deviceName: device.deviceName });
      await recordAudit({ actorUserId: user.id, action: "MOBILE_LOGIN_SUCCESS", ipAddress: req.ip });
      return ok(res, { user: toPublicUser(user), session: mobileSessionPayload(session) });
    } catch (err) {
      if (err instanceof AuthError) await recordAudit({ action: "MOBILE_LOGIN_FAILURE", metadata: { email: input.email }, ipAddress: req.ip });
      throw err;
    }
  }),
);

authRouter.post(
  "/mobile/refresh",
  requireAuth,
  asyncHandler(async (req, res) => {
    if (req.auth!.transport !== "MOBILE") throw Errors.unauthorized();
    const refreshed = await refreshSession(req.auth!.sessionId, req);
    if (!refreshed) throw Errors.unauthorized("Session expired. Please sign in again.");
    return ok(res, { session: mobileSessionPayload(refreshed) });
  }),
);

authRouter.post(
  "/mobile/logout",
  requireAuth,
  asyncHandler(async (req, res) => {
    if (req.auth!.transport !== "MOBILE") throw Errors.unauthorized();
    await revokeSession(req.auth!.sessionId);
    await recordAudit({ actorUserId: req.auth!.userId, action: "MOBILE_LOGOUT", ipAddress: req.ip });
    return ok(res, { success: true });
  }),
);

authRouter.post(
  "/register",
  authRateLimit,
  asyncHandler(async (req, res) => {
    const input = registerSchema.parse(req.body);
    const captchaOk = await verifyCaptcha(input.captchaToken, req.ip);
    if (!captchaOk) throw Errors.badRequest("Captcha verification failed. Please try again.");
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
  "/forgot-password",
  authRateLimit,
  asyncHandler(async (req, res) => {
    const input = forgotPasswordSchema.parse(req.body);
    await requestPasswordReset(input.email);
    // Identical response whether or not the email exists — see
    // requestPasswordReset's doc comment for why.
    return ok(res, { message: "If that email has an account, a reset link is on its way." });
  }),
);

authRouter.post(
  "/reset-password",
  authRateLimit,
  asyncHandler(async (req, res) => {
    const input = resetPasswordSchema.parse(req.body);
    const { userId } = await resetPassword(input.token, input.password);
    await recordAudit({ actorUserId: userId, action: "PASSWORD_RESET", targetType: "User", targetId: userId, ipAddress: req.ip });
    return ok(res, { success: true });
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
