import { Router } from "express";
import { asyncHandler, ok, requireParam } from "../../lib/http.js";
import { Errors } from "../../lib/apiError.js";
import { requireAuth } from "../../middleware/auth.js";
import { prisma } from "../../lib/prisma.js";
import { followIdentity, listFollowing, unfollowIdentity } from "./follows.service.js";

export const followsRouter = Router();
followsRouter.use(requireAuth);

// Auth-only and viewer-scoped on purpose — see follows.service.ts's doc
// comment on listFollowing for why this can never become a public endpoint.
followsRouter.get(
  "/mine",
  asyncHandler(async (req, res) => {
    return ok(res, await listFollowing(req.auth!.userId));
  }),
);

/**
 * Addressed by username, not identity id: every client surface that renders
 * a byline (a note's author, a profile page, a search result) already has
 * the username — none of those public DTOs carry PublicIdentity.id, and
 * deliberately so, since exposing it everywhere serves no purpose once
 * username already does the job.
 */
async function resolveIdentityIdByUsername(username: string): Promise<string> {
  const identity = await prisma.publicIdentity.findUnique({ where: { username }, select: { id: true, isVisible: true } });
  if (!identity || !identity.isVisible) throw Errors.notFound("Profile not found.");
  return identity.id;
}

followsRouter.post(
  "/:username",
  asyncHandler(async (req, res) => {
    const identityId = await resolveIdentityIdByUsername(requireParam(req, "username"));
    await followIdentity(req.auth!.userId, identityId);
    return ok(res, { following: true });
  }),
);

followsRouter.delete(
  "/:username",
  asyncHandler(async (req, res) => {
    const identityId = await resolveIdentityIdByUsername(requireParam(req, "username"));
    await unfollowIdentity(req.auth!.userId, identityId);
    return ok(res, { following: false });
  }),
);
