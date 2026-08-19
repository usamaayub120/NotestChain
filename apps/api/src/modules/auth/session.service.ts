import { randomBytes, createHash } from "node:crypto";
import type { Request } from "express";
import { prisma } from "../../lib/prisma.js";
import { SESSION_ABSOLUTE_TTL_MS, SESSION_IDLE_TTL_MS } from "../../config/security.js";
import type { SessionTransport } from "@prisma/client";

export interface IssuedSession {
  sessionId: string;
  token: string;
  csrfToken: string;
  expiresAt: Date;
  transport: SessionTransport;
}

function randomUrlSafeToken(): string {
  return randomBytes(32).toString("base64url");
}

export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export async function createSession(
  userId: string,
  req: Request,
  options: { transport?: SessionTransport; deviceName?: string } = {},
): Promise<IssuedSession> {
  const token = randomUrlSafeToken();
  const csrfToken = randomUrlSafeToken();
  const expiresAt = new Date(Date.now() + SESSION_IDLE_TTL_MS);

  const session = await prisma.session.create({
    data: {
      userId,
      tokenHash: hashToken(token),
      csrfSecret: csrfToken,
      expiresAt,
      userAgent: req.get("user-agent")?.slice(0, 512),
      ipAddress: req.ip,
      transport: options.transport ?? "WEB",
      deviceName: options.deviceName?.slice(0, 128),
    },
  });

  return { sessionId: session.id, token, csrfToken, expiresAt, transport: session.transport };
}

export interface ValidatedSession {
  sessionId: string;
  userId: string;
  csrfToken: string;
  transport: SessionTransport;
}

/** Returns null for any invalid/expired/revoked token — never throws on bad input. */
export async function validateSession(token: string): Promise<ValidatedSession | null> {
  const session = await prisma.session.findUnique({ where: { tokenHash: hashToken(token) } });
  if (!session || session.revokedAt) return null;
  if (session.expiresAt.getTime() < Date.now()) return null;

  await prisma.session.update({ where: { id: session.id }, data: { lastUsedAt: new Date() } });
  return { sessionId: session.id, userId: session.userId, csrfToken: session.csrfSecret, transport: session.transport };
}

/** Rotates the token (old one is revoked) and slides the idle expiry, capped by the absolute TTL. */
export async function refreshSession(sessionId: string, req: Request): Promise<IssuedSession | null> {
  const existing = await prisma.session.findUnique({ where: { id: sessionId } });
  if (!existing || existing.revokedAt) return null;

  const absoluteDeadline = existing.createdAt.getTime() + SESSION_ABSOLUTE_TTL_MS;
  if (Date.now() >= absoluteDeadline) {
    await prisma.session.update({ where: { id: sessionId }, data: { revokedAt: new Date() } });
    return null;
  }

  const token = randomUrlSafeToken();
  const csrfToken = randomUrlSafeToken();
  const expiresAt = new Date(Math.min(Date.now() + SESSION_IDLE_TTL_MS, absoluteDeadline));

  const rotated = await prisma.$transaction(async (tx) => {
    await tx.session.update({ where: { id: sessionId }, data: { revokedAt: new Date() } });
    return tx.session.create({
      data: {
        userId: existing.userId,
        tokenHash: hashToken(token),
        csrfSecret: csrfToken,
        expiresAt,
      userAgent: req.get("user-agent")?.slice(0, 512),
      ipAddress: req.ip,
      transport: existing.transport,
      deviceName: existing.deviceName,
      },
    });
  });

  return { sessionId: rotated.id, token, csrfToken, expiresAt, transport: rotated.transport };
}

export async function revokeSession(sessionId: string): Promise<void> {
  await prisma.session.update({ where: { id: sessionId }, data: { revokedAt: new Date() } });
}

export async function revokeAllSessionsForUser(userId: string): Promise<void> {
  await prisma.session.updateMany({
    where: { userId, revokedAt: null },
    data: { revokedAt: new Date() },
  });
}
