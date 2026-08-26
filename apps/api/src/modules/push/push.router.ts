import { Router } from "express";
import { registerPushTokenSchema } from "@noteschain/validation";
import { asyncHandler, ok } from "../../lib/http.js";
import { requireAuth } from "../../middleware/auth.js";
import { registerPushToken, unregisterPushToken } from "./push.service.js";

export const pushRouter = Router();
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
