import { randomBytes } from "node:crypto";
import argon2 from "argon2";
import type { Prisma } from "@prisma/client";
import { AccountStatus, Role, StaffRole } from "@noteschain/shared";
import { EmailKind, buildEmailJobData } from "@noteschain/email";
import { prisma } from "../../lib/prisma.js";
import { ARGON2_OPTIONS } from "../../config/security.js";
import { env } from "../../config/env.js";
import { createKeeperProfile, getKeeperProfile } from "../identities/keeperProfile.service.js";

export class AuthError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly code: string,
  ) {
    super(message);
  }
}

export async function hashPassword(password: string): Promise<string> {
  return argon2.hash(password, { type: argon2.argon2id, ...ARGON2_OPTIONS });
}

export async function verifyPassword(hash: string, password: string): Promise<boolean> {
  try {
    return await argon2.verify(hash, password);
  } catch {
    return false;
  }
}

export async function registerUser(
  email: string,
  password: string,
  keeperProfile?: { username?: string | null; displayName?: string | null },
) {
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    throw new AuthError("An account with this email already exists.", 409, "EMAIL_TAKEN");
  }

  const passwordHash = await hashPassword(password);
  const welcomeEmailData = buildEmailJobData(EmailKind.ACCOUNT_WELCOME, {
    startWritingUrl: `${env.PUBLIC_WEB_ORIGIN}/drafts`,
  });

  // User + Keeper profile + welcome-email job, all in one transaction: an
  // account must never exist without the public profile the rest of the
  // product assumes every account has, any more than it should exist without
  // the welcome email queued.
  return prisma.$transaction(async (tx) => {
    const user = await tx.user.create({
      data: { email, passwordHash, role: Role.USER, status: AccountStatus.ACTIVE },
    });
    const primaryIdentity = await createKeeperProfile(tx, {
      userId: user.id,
      email: user.email,
      username: keeperProfile?.username,
      displayName: keeperProfile?.displayName,
    });
    await tx.emailJob.create({
      data: {
        kind: EmailKind.ACCOUNT_WELCOME,
        toEmail: user.email,
        toUserId: user.id,
        data: welcomeEmailData as Prisma.InputJsonValue,
      },
    });
    return { user, primaryIdentity };
  });
}

export async function authenticateUser(email: string, password: string) {
  const user = await prisma.user.findUnique({ where: { email } });
  // Constant-shape response whether the account exists or not, to avoid
  // leaking which emails are registered via response timing/content.
  if (!user) {
    await argon2.hash(password, { type: argon2.argon2id, ...ARGON2_OPTIONS }).catch(() => undefined);
    throw new AuthError("Invalid email or password.", 401, "INVALID_CREDENTIALS");
  }

  const valid = await verifyPassword(user.passwordHash, password);
  if (!valid) {
    throw new AuthError("Invalid email or password.", 401, "INVALID_CREDENTIALS");
  }

  if (user.status !== AccountStatus.ACTIVE) {
    throw new AuthError("This account is not able to sign in.", 403, "ACCOUNT_NOT_ACTIVE");
  }

  await prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
  return user;
}

/**
 * Self-service account deletion. A hard `DELETE` of the User row is not an
 * option: `Publication.privateAuthorUserId` and `Comment.authorUserId` are
 * required foreign keys with `ON DELETE RESTRICT`, so the database itself
 * refuses to delete any user who ever published or commented — the whole
 * point of the product is that published content stays put. So this scrubs
 * everything that's genuinely private (login credentials, unpublished
 * drafts) and leaves already-public content and its attribution exactly as
 * published, matching the existing `USER_SUSPENDED` moderation precedent
 * (status flip + session revocation) rather than a moderation action.
 */
export async function deleteOwnAccount(userId: string, password: string): Promise<void> {
  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
  const valid = await verifyPassword(user.passwordHash, password);
  if (!valid) {
    throw new AuthError("Incorrect password.", 401, "INVALID_CREDENTIALS");
  }

  const tombstoneEmail = `deleted-${userId}@noteschain.invalid`;

  await prisma.$transaction(async (tx) => {
    await tx.user.update({
      where: { id: userId },
      data: {
        status: AccountStatus.DELETED,
        email: tombstoneEmail,
        passwordHash: randomBytes(32).toString("hex"),
        commentDisplayName: null,
      },
    });

    // Delivery-log rows keep the plaintext address they were sent to at the
    // time — not joined live — so the tombstone above doesn't reach them on
    // its own.
    await tx.emailJob.updateMany({
      where: { toUserId: userId },
      data: { toEmail: tombstoneEmail },
    });

    // Only unpublished drafts are genuinely private working material. A
    // draft that made it to PUBLISHED stays — deleting it would cascade to
    // its Submission/ModerationDecision chain, destroying the moderator's
    // own audit trail for content that is still live and public.
    await tx.draft.deleteMany({ where: { userId, publication: null } });

    // The account is gone, so following it (or it following anyone) stops
    // meaning anything. Deleted in both directions: this account's own
    // following list, and anyone who followed one of its bylines.
    const ownedIdentityIds = (await tx.publicIdentity.findMany({ where: { userId }, select: { id: true } })).map(
      (identity) => identity.id,
    );
    await tx.follow.deleteMany({
      where: { OR: [{ followerUserId: userId }, { targetIdentityId: { in: ownedIdentityIds } }] },
    });

    // Nothing left to notify and nowhere left to send it — this account's
    // registered devices and anything still queued for them. Cascade
    // deletes on User don't fire here because this is a soft delete (the
    // User row itself survives, tombstoned).
    await tx.pushToken.deleteMany({ where: { userId } });
    await tx.pushJob.deleteMany({ where: { userId } });

    const identities = await tx.publicIdentity.findMany({ where: { userId } });
    for (const identity of identities) {
      const [publicationCount, commentCount] = await Promise.all([
        tx.publication.count({ where: { publicIdentityId: identity.id } }),
        tx.comment.count({ where: { publicIdentityId: identity.id } }),
      ]);
      if (publicationCount > 0 || commentCount > 0) {
        // Same rule as identities.service.ts's deleteIdentity: never remove a
        // byline that has already been shown to readers — Publication and
        // Comment both still join to it live for their byline, so the row
        // has to survive. Only the standalone profile disappears (isVisible)
        // and the personal fields scrub. displayName/username are left
        // alone deliberately: they are the byline text itself, already
        // public on every note and comment it's attached to, not private
        // profile embellishment the way an avatar photo or bio is.
        await tx.publicIdentity.update({
          where: { id: identity.id },
          data: {
            isVisible: false,
            bio: "",
            avatarUrl: null,
            links: [],
            location: null,
            pronouns: null,
            birthDate: null,
            showBirthDate: false,
            gender: null,
            showGender: false,
          },
        });
      } else {
        await tx.publicIdentity.delete({ where: { id: identity.id } });
      }
    }
  });
}

export type PrimaryIdentitySummary = {
  username: string;
  displayName: string;
  avatarUrl: string | null;
  canChangeUsername: boolean;
} | null;

/** Never returns userId anywhere it could leak — see identities.service.ts. */
function summarizePrimaryIdentity(
  identity: {
    username: string;
    displayName: string;
    avatarUrl: string | null;
    usernameChangedAt: Date | null;
  } | null,
): PrimaryIdentitySummary {
  if (!identity) return null;
  return {
    username: identity.username,
    displayName: identity.displayName,
    avatarUrl: identity.avatarUrl,
    canChangeUsername: identity.usernameChangedAt === null,
  };
}

export function toPublicUser(
  user: {
    id: string;
    email: string;
    role: string;
    status: string;
    createdAt: Date;
    commentDisplayName?: string | null;
    roles?: string[];
  },
  primaryIdentity: Parameters<typeof summarizePrimaryIdentity>[0] = null,
) {
  return {
    id: user.id,
    email: user.email,
    role: user.role,
    roles: user.roles ?? (user.role === Role.ADMIN ? [StaffRole.PLATFORM_ADMIN] : user.role === Role.MODERATOR ? [StaffRole.MODERATOR] : []),
    status: user.status,
    createdAt: user.createdAt,
    commentDisplayName: user.commentDisplayName ?? null,
    // Every active account has one after the backfill; only reachable as null
    // for an account created by a path that predates it.
    primaryIdentity: summarizePrimaryIdentity(primaryIdentity),
  };
}

/** Convenience for call sites that only have a userId, not an already-loaded identity. */
export async function toPublicUserWithProfile(user: Parameters<typeof toPublicUser>[0]) {
  const [profile, staffRoles] = await Promise.all([
    getKeeperProfile(user.id),
    prisma.staffRoleAssignment.findMany({ where: { userId: user.id }, select: { role: true } }),
  ]);
  return toPublicUser({ ...user, roles: staffRoles.map((assignment) => assignment.role) }, profile);
}
