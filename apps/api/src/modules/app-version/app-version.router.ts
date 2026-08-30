import { Router } from "express";
import { env } from "../../config/env.js";
import { ok } from "../../lib/http.js";

/**
 * Public mobile release policy. The Android versionCode is the authority;
 * latestVersion exists only for the human-facing update message.
 */
export const appVersionRouter = Router();

appVersionRouter.get("/version", (_req, res) => {
  // A foregrounded app must see a policy change promptly, especially when a
  // security release becomes mandatory. Do not let an intermediary cache it.
  res.set("Cache-Control", "no-store");
  return ok(res, {
    android: {
      latestBuild: env.ANDROID_LATEST_BUILD,
      minimumBuild: env.ANDROID_MINIMUM_BUILD,
      latestVersion: env.ANDROID_LATEST_VERSION,
    },
  });
});
