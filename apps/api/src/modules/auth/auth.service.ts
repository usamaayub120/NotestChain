import argon2 from "argon2";
import { AccountStatus, Role } from "@noteschain/shared";
import { prisma } from "../../lib/prisma.js";
import { ARGON2_OPTIONS } from "../../config/security.js";

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
  return prisma.user.create({
    data: { email, passwordHash, role: Role.USER, status: AccountStatus.ACTIVE },
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
