import { randomBytes } from "node:crypto";
import type { Prisma, PrismaClient } from "@prisma/client";
import { IdentityType, slugifyUsername, usernameFromEmail, withUsernameSuffix } from "@noteschain/shared";
import { prisma } from "../../lib/prisma.js";
import { Errors } from "../../lib/apiError.js";

/** Last-resort base when neither a chosen name nor an email yields a slug. */
const FALLBACK_USERNAME_BASE = "keeper";
/** How many `base-2`, `base-3`… attempts before switching to random suffixes. */
const SEQUENTIAL_ATTEMPTS = 12;
const RANDOM_ATTEMPTS = 5;

type Tx = Prisma.TransactionClient | PrismaClient;

async function isUsernameFree(client: Tx, username: string): Promise<boolean> {
  return (await client.publicIdentity.findUnique({ where: { username }, select: { id: true } })) === null;
}

/**
 * Resolves the username a new Keeper profile should take.
 *
 * A username the person actually chose is never silently altered — if it is
 * taken they get a 409 and pick another. Only *generated* usernames (the
 * backfill, and registrations from an older client that doesn't send one) are
 * suffixed until they fit.
 *
 * The unique constraint remains the real guard: this loop narrows the race
 * window, it does not close it, so callers must still handle P2002.
 */
export async function resolveUsername(
  client: Tx,
  { chosen, emailSeed }: { chosen?: string | null; emailSeed?: string | null },
): Promise<string> {
  if (chosen) {
    if (!(await isUsernameFree(client, chosen))) {
      throw Errors.conflict("That username is already taken.");
    }
    return chosen;
  }

  const base =
    (emailSeed ? usernameFromEmail(emailSeed) : null) ??
    slugifyUsername(FALLBACK_USERNAME_BASE) ??
    FALLBACK_USERNAME_BASE;

  if (await isUsernameFree(client, base)) return base;

  for (let n = 2; n < 2 + SEQUENTIAL_ATTEMPTS; n += 1) {
    const candidate = withUsernameSuffix(base, String(n));
    if (await isUsernameFree(client, candidate)) return candidate;
  }

  for (let attempt = 0; attempt < RANDOM_ATTEMPTS; attempt += 1) {
    const candidate = withUsernameSuffix(base, randomBytes(3).toString("hex"));
    if (await isUsernameFree(client, candidate)) return candidate;
  }

  throw Errors.conflict("Could not allocate a username. Please choose one.");
}

/**
 * Creates the one identity every Keeper has: their own public profile.
 *
 * `isPrimary` is set here and nowhere else. A partial unique index
 * (PublicIdentity_userId_primary_key) makes a second one impossible even if a
 * code path tries.
 *
 * `usernameChangedAt` records whether the handle was chosen or generated:
 * null means generated, so the owner is still owed one free rename. A username
 * the user typed counts as already chosen.
 */
export async function createKeeperProfile(
  client: Tx,
  {
    userId,
    email,
    username,
    displayName,
  }: { userId: string; email: string; username?: string | null; displayName?: string | null },
) {
  const resolved = await resolveUsername(client, { chosen: username, emailSeed: email });
  return client.publicIdentity.create({
    data: {
      userId,
      type: IdentityType.REAL_NAME,
      isPrimary: true,
      username: resolved,
      displayName: displayName?.trim() || resolved,
      usernameChangedAt: username ? new Date() : null,
    },
  });
}

/**
 * The Keeper profile for a user. Every active account has one after the
 * backfill; the null case is only reachable for accounts created by a code
 * path that predates this, so callers should treat it as an error rather than
 * papering over it.
 */
export async function getKeeperProfile(userId: string) {
  return prisma.publicIdentity.findFirst({ where: { userId, isPrimary: true } });
}

export async function requireKeeperProfile(userId: string) {
  const profile = await getKeeperProfile(userId);
  if (!profile) throw Errors.badRequest("Set up your Keeper profile before publishing or commenting.");
  return profile;
}
