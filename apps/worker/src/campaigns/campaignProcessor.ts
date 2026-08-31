import { getMessaging } from "firebase-admin/messaging";
import { prisma } from "../lib/prisma.js";
import { logger } from "../lib/logger.js";
import { getFirebaseApp } from "../push/firebaseCredential.js";
import { isFirebaseConfigured } from "@noteschain/push";
import { env } from "../config/env.js";
import { createDecipheriv } from "node:crypto";
import { readFileSync } from "node:fs";

function decryptInstallationToken(ciphertext: string): string {
  if (!env.PUSH_TOKEN_ENCRYPTION_KEY_PATH) throw new Error("Campaign installation encryption key is not configured.");
  const key = Buffer.from(readFileSync(env.PUSH_TOKEN_ENCRYPTION_KEY_PATH, "utf8").trim(), "base64");
  if (key.length !== 32) throw new Error("Campaign installation encryption key is invalid.");
  const payload = Buffer.from(ciphertext, "base64");
  const decipher = createDecipheriv("aes-256-gcm", key, payload.subarray(0, 12));
  decipher.setAuthTag(payload.subarray(12, 28));
  return Buffer.concat([decipher.update(payload.subarray(28)), decipher.final()]).toString("utf8");
}

/**
 * Campaign delivery intentionally differs from event PushJob retries. FCM has
 * no idempotency key: after a handoff uncertainty we record UNKNOWN and never
 * auto-send a second notification to that device.
 */
export async function processCampaignDelivery(): Promise<void> {
  if (!isFirebaseConfigured(env)) return;
  const recipient = await prisma.$transaction(async (tx) => {
    const dueRun = await tx.campaignRun.findFirst({
      where: { scheduledAt: { lte: new Date() }, campaign: { status: { in: ["SCHEDULED", "RUNNING"] } } },
      orderBy: { scheduledAt: "asc" }, include: { version: true, campaign: true },
    });
    if (!dueRun) return null;
    if (dueRun.campaign.status === "SCHEDULED") await tx.campaign.update({ where: { id: dueRun.campaignId }, data: { status: "RUNNING" } });
    const item = await tx.campaignRecipient.findFirst({ where: { runId: dueRun.id, status: "PENDING" }, orderBy: { createdAt: "asc" } });
    if (!item) {
      const outstanding = await tx.campaignRecipient.count({ where: { runId: dueRun.id, status: { in: ["PENDING", "SENDING"] } } });
      if (outstanding === 0) {
        await tx.campaignRun.update({ where: { id: dueRun.id }, data: { completedAt: new Date() } });
        if (!(dueRun.version.schedule as { recurring?: boolean }).recurring) await tx.campaign.update({ where: { id: dueRun.campaignId }, data: { status: "COMPLETED" } });
      }
      return null;
    }
    const claimed = await tx.campaignRecipient.updateMany({ where: { id: item.id, status: "PENDING" }, data: { status: "SENDING" } });
    if (claimed.count !== 1) return null;
    return { recipient: item, version: dueRun.version };
  });
  if (!recipient) return;

  const installation = recipient.recipient.endpointKind === "PUSH_INSTALLATION"
    ? await prisma.pushInstallation.findUnique({ where: { id: recipient.recipient.endpointId }, select: { id: true, tokenCiphertext: true, productOptIn: true, permissionGranted: true, timeZone: true } })
    : null;
  if (!installation || !installation.productOptIn || !installation.permissionGranted || !installation.timeZone) {
    await prisma.campaignRecipient.update({ where: { id: recipient.recipient.id }, data: { status: "SUPPRESSED", suppressedReason: "Endpoint removed" } });
    return;
  }
  try {
    await getMessaging(getFirebaseApp()).send({
      token: decryptInstallationToken(installation.tokenCiphertext),
      notification: { title: recipient.version.title, body: recipient.version.body },
      data: { deepLink: recipient.version.deepLink, campaignDelivery: recipient.recipient.deliveryToken },
      android: { notification: { channelId: "noteschain-alerts-v1", sound: "noteschain_calm_signal.wav" } },
      apns: { payload: { aps: { sound: "noteschain_calm_signal.wav" } } },
    });
    await prisma.$transaction([
      prisma.campaignRecipient.update({ where: { id: recipient.recipient.id }, data: { status: "ACCEPTED", acceptedAt: new Date() } }),
      prisma.campaignRun.update({ where: { id: recipient.recipient.runId }, data: { acceptedCount: { increment: 1 } } }),
    ]);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const permanent = /registration-token-not-registered|invalid-registration-token/.test(message);
    if (permanent) await prisma.pushInstallation.delete({ where: { id: installation.id } }).catch(() => undefined);
    await prisma.campaignRecipient.update({ where: { id: recipient.recipient.id }, data: { status: permanent ? "FAILED" : "UNKNOWN", lastError: message.slice(0, 500) } });
    logger.warn({ campaignRecipientId: recipient.recipient.id, permanent, error: message }, "Campaign push not accepted");
  }
}
