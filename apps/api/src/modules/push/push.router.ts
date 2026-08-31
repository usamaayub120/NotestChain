import { Router } from "express";
import { recordCampaignOpenSchema, registerPushInstallationSchema, registerPushTokenSchema } from "@noteschain/validation";
import { asyncHandler, ok } from "../../lib/http.js";
import { requireAuth } from "../../middleware/auth.js";
import { registerPushToken, unregisterPushToken } from "./push.service.js";
import { verifyAppCheck } from "./appCheck.js";
import { detachPushInstallation, recordCampaignOpen, registerPushInstallation } from "./installation.service.js";
import { pushInstallationRateLimit } from "../../middleware/rateLimit.js";

export const pushRouter = Router();

/** Public only to an attested native app; it never exposes installations. */
pushRouter.post("/installations", pushInstallationRateLimit, asyncHandler(async (req, res) => {
  await verifyAppCheck(req.get("x-firebase-appcheck"));
  const input = registerPushInstallationSchema.parse(req.body);
  const userId = req.auth?.transport === "MOBILE" ? req.auth.userId : undefined;
  return ok(res, await registerPushInstallation(input, userId), 201);
}));

pushRouter.post("/installations/detach", pushInstallationRateLimit, asyncHandler(async (req, res) => {
  await verifyAppCheck(req.get("x-firebase-appcheck"));
  const input = registerPushInstallationSchema.pick({ installationId: true, credential: true }).parse(req.body);
  await detachPushInstallation(input.installationId, input.credential);
  return ok(res, { detached: true });
}));

pushRouter.post("/campaigns/open", pushInstallationRateLimit, asyncHandler(async (req, res) => {
  await verifyAppCheck(req.get("x-firebase-appcheck"));
  const input = recordCampaignOpenSchema.parse(req.body);
  await recordCampaignOpen(input.installationId, input.credential, input.deliveryToken);
  return ok(res, { recorded: true });
}));

pushRouter.use(requireAuth);

pushRouter.post(
  "/tokens",
  asyncHandler(async (req, res) => {
    const input = registerPushTokenSchema.parse(req.body);
    await registerPushToken(req.auth!.userId, input);
    return ok(res, { registered: true }, 201);
  }),
);

// Body, not a :token URL param — a raw FCM token can contain characters
// (`/`, `+`) that don't survive round-tripping through a path segment
// cleanly, and it never needs to be a bookmarkable/loggable URL the way a
// resource id does.
pushRouter.delete(
  "/tokens",
  asyncHandler(async (req, res) => {
    const input = registerPushTokenSchema.pick({ token: true }).parse(req.body);
    await unregisterPushToken(req.auth!.userId, input.token);
    return ok(res, { registered: false });
  }),
);
