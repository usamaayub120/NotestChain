import { timingSafeEqual } from "node:crypto";
import { Router } from "express";
import { syncAndroidLatestBuildSchema } from "@noteschain/validation";
import { env } from "../../config/env.js";
import { Errors } from "../../lib/apiError.js";
import { asyncHandler, ok } from "../../lib/http.js";
import { syncAndroidLatestBuild } from "../admin/settings.service.js";

const RELEASE_POLICY_TOKEN_HEADER = "x-noteschain-release-policy-token";

function hasValidReleasePolicyToken(token: string | undefined): boolean {
  const expected = env.RELEASE_POLICY_WEBHOOK_SECRET;
  if (!expected || !token) return false;

  const actualBytes = Buffer.from(token);
  const expectedBytes = Buffer.from(expected);
  return actualBytes.length === expectedBytes.length && timingSafeEqual(actualBytes, expectedBytes);
}

/**
 * Narrow machine-to-machine endpoint for GitHub release automation. It can
 * advance only latestBuild/latestVersion; minimumBuild stays admin-controlled.
 */
export const releasePolicyRouter = Router();

releasePolicyRouter.post(
  "/android/latest",
  asyncHandler(async (req, res) => {
    // Do not advertise an endpoint that has not been explicitly provisioned.
    if (!env.RELEASE_POLICY_WEBHOOK_SECRET) throw Errors.notFound();
    if (!hasValidReleasePolicyToken(req.get(RELEASE_POLICY_TOKEN_HEADER))) {
      throw Errors.unauthorized("Invalid release policy token.");
    }

    const input = syncAndroidLatestBuildSchema.parse(req.body);
    const result = await syncAndroidLatestBuild(input, req.ip);
    return ok(res, {
      android: {
        latestBuild: result.settings.androidLatestBuild,
        minimumBuild: result.settings.androidMinimumBuild,
        latestVersion: result.settings.androidLatestVersion,
      },
      changed: result.changed,
    });
  }),
);
