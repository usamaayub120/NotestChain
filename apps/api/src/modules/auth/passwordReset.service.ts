import { randomBytes } from "node:crypto";
import type { Prisma } from "@prisma/client";
import { EmailKind, buildEmailJobData } from "@noteschain/email";
import { prisma } from "../../lib/prisma.js";
import { Errors } from "../../lib/apiError.js";
import { env } from "../../config/env.js";
import { hashToken } from "./session.service.js";
import { hashPassword } from "./auth.service.js";

const RESET_TOKEN_TTL_MS = 30 * 60 * 1000;

function randomUrlSafeToken(): string {
  return randomBytes(32).toString("base64url");
}

/**
 * Always resolves the same way from the caller's point of view whether or
 * not the email belongs to an account — the router returns one generic
 * message regardless, so this endpoint can't be used to discover which
 * emails are registered. Only enqueues anything when there's a real user.
 *
 * Token handling mirrors Session's exactly (session.service.ts): only the
 * SHA-256 hash is ever persisted, the raw token is emailed once and never
 * stored anywhere else.
 */
export async function requestPasswordReset(email: string): Promise<void> {
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) return;

  const token = randomUrlSafeToken();
  const expiresAt = new Date(Date.now() + RESET_TOKEN_TTL_MS);
  const emailData = buildEmailJobData(EmailKind.PASSWORD_RESET_REQUESTED, {
    resetUrl: `${env.PUBLIC_WEB_ORIGIN}/reset-password?token=${token}`,
    expiryMinutes: Math.round(RESET_TOKEN_TTL_MS / 60_000),
  });

  await prisma.$transaction([
    prisma.passwordResetToken.create({
      data: { userId: user.id, tokenHash: hashToken(token), expiresAt },
    }),
    prisma.emailJob.create({
      data: {
        kind: EmailKind.PASSWORD_RESET_REQUESTED,
        toEmail: user.email,
        toUserId: user.id,
        data: emailData as Prisma.InputJsonValue,
      },
    }),
  ]);
}

/** Throws on any invalid, expired, or already-used token — never reveals which. Returns the affected userId for the caller's own audit log. */
export async function resetPassword(token: string, newPassword: string): Promise<{ userId: string }> {
  const record = await prisma.passwordResetToken.findUnique({ where: { tokenHash: hashToken(token) } });
  if (!record || record.usedAt || record.expiresAt.getTime() < Date.now()) {
    throw Errors.badRequest("This reset link is invalid or has expired.");
  }

  const passwordHash = await hashPassword(newPassword);

  await prisma.$transaction(async (tx) => {
    await tx.passwordResetToken.update({ where: { id: record.id }, data: { usedAt: new Date() } });
    await tx.user.update({ where: { id: record.userId }, data: { passwordHash } });
    // Defense in depth, in the same transaction as the password change
    // itself so it can't succeed halfway: a session cookie stolen before
    // the reset shouldn't survive it.
    await tx.session.updateMany({
      where: { userId: record.userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  });

  return { userId: record.userId };
}
