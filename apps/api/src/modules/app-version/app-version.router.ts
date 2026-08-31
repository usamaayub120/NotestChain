import { Router } from "express";
import { asyncHandler, ok } from "../../lib/http.js";
import { getSiteSettings } from "../admin/settings.service.js";

/**
 * Public mobile release policy. The Android versionCode is the authority;
 * latestVersion exists only for the human-facing update message.
 */
export const appVersionRouter = Router();

appVersionRouter.get("/version", asyncHandler(async (_req, res) => {
  // A foregrounded app must see a policy change promptly, especially when a
  // security release becomes mandatory. Do not let an intermediary cache it.
  res.set("Cache-Control", "no-store");
  const settings = await getSiteSettings();
  return ok(res, {
    android: {
      latestBuild: settings.androidLatestBuild,
      minimumBuild: settings.androidMinimumBuild,
      latestVersion: settings.androidLatestVersion,
    },
  });
}));
