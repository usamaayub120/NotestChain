import { PushKind } from "@noteschain/push";
import type { RegisterPushTokenInput } from "@noteschain/validation";
import { buildPushJobData } from "@noteschain/push";
import type { Prisma, PrismaClient } from "@prisma/client";
import { prisma } from "../../lib/prisma.js";

type Tx = Prisma.TransactionClient | PrismaClient;

/**
 * A token belongs to a device, not permanently to whoever is signed in on
 * it — registering an already-known token just reassigns it to the current
 * user (a device that changes accounts, or a shared/test device). No
 * cross-account leak: only the token string itself moves, never anything
 * about the account that previously owned it.
 */
export async function registerPushToken(userId: string, input: RegisterPushTokenInput) {
  return prisma.pushToken.upsert({
    where: { token: input.token },
    update: { userId, platform: input.platform },
    create: { userId, token: input.token, platform: input.platform },
  });
}

export async function unregisterPushToken(userId: string, token: string): Promise<void> {
  // Scoped to userId as well as token: a signed-out device unregistering
  // its own token should never be able to delete a row it doesn't own,
  // even if it somehow knew another device's token string.
  await prisma.pushToken.deleteMany({ where: { token, userId } });
}

/**
 * Enqueues a PushJob in the given transaction — mirrors
 * @noteschain/email's buildEmailJobData call sites exactly: validated
 * against the kind's schema before the row is ever created, inserted in
 * the SAME transaction as the business event that causes it, so a
 * rollback cancels the notification too.
 */
export async function enqueuePush<K extends PushKind>(
  tx: Tx,
  userId: string,
  kind: K,
  data: Parameters<typeof buildPushJobData<K>>[1],
): Promise<void> {
  await tx.pushJob.create({
    data: { userId, kind, data: buildPushJobData(kind, data) as Prisma.InputJsonValue },
  });
}

export { PushKind };
