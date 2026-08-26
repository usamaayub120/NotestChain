import { Prisma } from "@prisma/client";
import { PushKind } from "@noteschain/push";
import { prisma } from "../../lib/prisma.js";
import { Errors } from "../../lib/apiError.js";
import { getKeeperProfile } from "../identities/keeperProfile.service.js";
import { enqueuePush } from "../push/push.service.js";

/**
 * Below this many followers, a profile's count is not shown at all — only
 * "New". Two pen names that both cross 1 or 2 followers around the same time
 * are trivially correlated by an observer polling the endpoint; requiring a
 * real audience before the number appears removes that signal without
 * removing the feature.
 */
const FOLLOWER_COUNT_VISIBLE_AT = 10;

async function getFollowableIdentity(identityId: string) {
  const identity = await prisma.publicIdentity.findUnique({ where: { id: identityId } });
  if (!identity || !identity.isVisible) throw Errors.notFound("Profile not found.");
  return identity;
}

/**
 * Following is always done as the account itself, never as one of its pen
 * names — "who does this pen name follow" would fingerprint its owner's own
 * taste graph and link it back to them. There is deliberately no way to
 * follow "as" an identity.
 */
export async function followIdentity(followerUserId: string, targetIdentityId: string) {
  const target = await getFollowableIdentity(targetIdentityId);
  if (target.userId === followerUserId) {
    throw Errors.badRequest("You can't follow one of your own bylines.");
  }

  // The follower shown in the notification is always the follower's own
  // Keeper profile, never a pen name — Follow.followerUserId can only ever
  // be an account (see the doc comment above), so this is always the
  // follower's already-public identity, not a correlation leak between two
  // of their own bylines. requireKeeperProfile isn't used here: a missing
  // Keeper profile would mean the follow itself is broken, not just the
  // notification, so a hard failure here is deliberate — see the test for
  // "every account has one after the backfill."
  const followerProfile = await getKeeperProfile(followerUserId);

  // Follow has no updatedAt to diff against, so "is this a genuinely new
  // follow" is answered by checking first rather than by inspecting what
  // upsert did — an already-following request must never re-notify the
  // target just because a client retried it.
  const alreadyFollowing = await prisma.follow.findUnique({
    where: { followerUserId_targetIdentityId: { followerUserId, targetIdentityId } },
    select: { followerUserId: true },
  });
  if (alreadyFollowing) return;

  try {
    await prisma.$transaction(async (tx) => {
      await tx.follow.create({ data: { followerUserId, targetIdentityId } });
      if (followerProfile) {
        await enqueuePush(tx, target.userId, PushKind.NEW_FOLLOWER, {
          followerUsername: followerProfile.username,
          followerDisplayName: followerProfile.displayName,
          targetUsername: target.username,
          targetDisplayName: target.displayName,
        });
      }
    });
  } catch (err) {
    // Two concurrent follow requests both passed the check above — the
    // unique constraint is the real guard, and losing this race just means
    // the follow already exists, which is the outcome we wanted anyway.
    if (!(err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002")) throw err;
  }
}

export async function unfollowIdentity(followerUserId: string, targetIdentityId: string) {
  await prisma.follow.deleteMany({ where: { followerUserId, targetIdentityId } });
}

/**
 * The viewer's own following list — visible only to its owner. A public
 * following list would be the single strongest correlator between a Keeper
 * and their pen names (follow the same three obscure accounts from both →
 * linked), so this must never be exposed for anyone but req.auth.userId.
 */
export async function listFollowing(followerUserId: string) {
  const follows = await prisma.follow.findMany({
    where: { followerUserId },
    include: { target: true },
    orderBy: { createdAt: "desc" },
  });
  return follows
    .filter((follow) => follow.target.isVisible)
    .map((follow) => ({
      id: follow.target.id,
      username: follow.target.username,
      displayName: follow.target.displayName,
      avatarUrl: follow.target.avatarUrl,
      isPrimary: follow.target.isPrimary,
      followedAt: follow.createdAt,
    }));
}

/** The bare list of ids a Keeper follows — what the Following feed filters on. */
export async function listFollowingIdentityIds(followerUserId: string): Promise<string[]> {
  const follows = await prisma.follow.findMany({ where: { followerUserId }, select: { targetIdentityId: true } });
  return follows.map((f) => f.targetIdentityId);
}

export async function isFollowing(followerUserId: string | undefined, targetIdentityId: string): Promise<boolean> {
  if (!followerUserId) return false;
  const follow = await prisma.follow.findUnique({
    where: { followerUserId_targetIdentityId: { followerUserId, targetIdentityId } },
    select: { followerUserId: true },
  });
  return follow !== null;
}

/**
 * The count shown on a profile. Below FOLLOWER_COUNT_VISIBLE_AT this is
 * always null — the profiles DTO renders that as "New" rather than a raw
 * number, never the member list. There is no endpoint that returns the
 * follower list itself.
 */
export async function followerCountFor(targetIdentityId: string): Promise<number | null> {
  const count = await prisma.follow.count({ where: { targetIdentityId } });
  return count >= FOLLOWER_COUNT_VISIBLE_AT ? count : null;
}
