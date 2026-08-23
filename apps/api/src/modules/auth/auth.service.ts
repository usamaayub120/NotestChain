import { randomBytes } from "node:crypto";
import argon2 from "argon2";
import type { Prisma } from "@prisma/client";
import { AccountStatus, Role } from "@noteschain/shared";
import { EmailKind, buildEmailJobData } from "@noteschain/email";
import { prisma } from "../../lib/prisma.js";
import { ARGON2_OPTIONS } from "../../config/security.js";
import { env } from "../../config/env.js";

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

export async function registerUser(email: string, password: string) {
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    throw new AuthError("An account with this email already exists.", 409, "EMAIL_TAKEN");
  }

  const passwordHash = await hashPassword(password);
  const welcomeEmailData = buildEmailJobData(EmailKind.ACCOUNT_WELCOME, {
    startWritingUrl: `${env.PUBLIC_WEB_ORIGIN}/drafts`,
  });

  // User + welcome-email job in one transaction: this is a welcome-only
  // email (no verification gate, no change to login), so the only property
  // that matters is that an account never exists without one queued.
  return prisma.$transaction(async (tx) => {
    const user = await tx.user.create({
      data: { email, passwordHash, role: Role.USER, status: AccountStatus.ACTIVE },
    });
    await tx.emailJob.create({
      data: {
        kind: EmailKind.ACCOUNT_WELCOME,
        toEmail: user.email,
        toUserId: user.id,
        data: welcomeEmailData as Prisma.InputJsonValue,
      },
    });
    return user;
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

    const identities = await tx.publicIdentity.findMany({ where: { userId } });
    for (const identity of identities) {
      const publicationCount = await tx.publication.count({ where: { publicIdentityId: identity.id } });
      if (publicationCount > 0) {
        // Same rule as identities.service.ts's deleteIdentity: never remove
        // an identity with attributed publications, just hide its profile.
        await tx.publicIdentity.update({ where: { id: identity.id }, data: { isVisible: false } });
      } else {
        await tx.publicIdentity.delete({ where: { id: identity.id } });
      }
    }
  });
}

export function toPublicUser(user: {
  id: string;
  email: string;
  role: string;
  status: string;
  createdAt: Date;
  commentDisplayName?: string | null;
}) {
  return {
    id: user.id,
    email: user.email,
    role: user.role,
    status: user.status,
    createdAt: user.createdAt,
    commentDisplayName: user.commentDisplayName ?? null,
  };
}
