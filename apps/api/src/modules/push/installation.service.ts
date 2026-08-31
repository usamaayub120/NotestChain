import type { RegisterPushInstallationInput } from "@noteschain/validation";
import { prisma } from "../../lib/prisma.js";
import { Errors } from "../../lib/apiError.js";
import { encryptPushToken, hashInstallationCredential, lookupPushToken } from "./installationCrypto.js";

export async function registerPushInstallation(input: RegisterPushInstallationInput, userId?: string) {
  const credentialHash = hashInstallationCredential(input.credential);
  const tokenLookupHash = lookupPushToken(input.token);
  const existingById = await prisma.pushInstallation.findUnique({ where: { id: input.installationId } });
  const existingByToken = await prisma.pushInstallation.findUnique({ where: { tokenLookupHash } });
  if (existingById && existingById.credentialHash !== credentialHash) throw Errors.forbidden("Installation credential does not match.");
  if (existingByToken && existingByToken.id !== input.installationId) throw Errors.conflict("This notification endpoint belongs to another installation.");
  if (!input.productOptIn && !input.activityAlertsOptIn) {
    if (existingById) await prisma.pushInstallation.delete({ where: { id: existingById.id } });
    return { registered: false };
  }
  const now = new Date();
  await prisma.pushInstallation.upsert({
    where: { id: input.installationId },
    create: {
      id: input.installationId, credentialHash, userId: userId ?? null, tokenCiphertext: encryptPushToken(input.token), tokenLookupHash,
      platform: input.platform, productOptIn: input.productOptIn, activityAlertsOptIn: input.activityAlertsOptIn, permissionGranted: input.permissionGranted,
      timeZone: input.timeZone, appVersion: input.appVersion, lastForegroundAt: now, productOptInAt: input.productOptIn ? now : null,
    },
    update: {
      userId: userId ?? existingById?.userId ?? null, tokenCiphertext: encryptPushToken(input.token), tokenLookupHash,
      platform: input.platform, productOptIn: input.productOptIn, activityAlertsOptIn: input.activityAlertsOptIn, permissionGranted: input.permissionGranted,
      timeZone: input.timeZone, appVersion: input.appVersion, lastSeenAt: now, lastForegroundAt: now, productOptInAt: input.productOptIn ? existingById?.productOptInAt ?? now : null,
    },
  });
  return { registered: true };
}

export async function detachPushInstallation(installationId: string, credential: string) {
  const installation = await prisma.pushInstallation.findUnique({ where: { id: installationId } });
  if (!installation || installation.credentialHash !== hashInstallationCredential(credential)) throw Errors.forbidden("Installation credential does not match.");
  await prisma.pushInstallation.update({ where: { id: installationId }, data: { userId: null, lastSeenAt: new Date() } });
}

/** An opaque FCM handoff identifier is the only campaign signal the app can report. */
export async function recordCampaignOpen(installationId: string, credential: string, deliveryToken: string) {
  const installation = await prisma.pushInstallation.findUnique({ where: { id: installationId }, select: { id: true, credentialHash: true } });
  if (!installation || installation.credentialHash !== hashInstallationCredential(credential)) throw Errors.forbidden();
  const recipient = await prisma.campaignRecipient.findFirst({ where: { endpointId: installationId, endpointKind: "PUSH_INSTALLATION", deliveryToken, acceptedAt: { not: null }, openedAt: null }, select: { id: true, runId: true } });
  if (!recipient) return;
  await prisma.$transaction(async (tx) => {
    const updated = await tx.campaignRecipient.updateMany({ where: { id: recipient.id, openedAt: null }, data: { openedAt: new Date() } });
    if (updated.count) await tx.campaignRun.update({ where: { id: recipient.runId }, data: { openCount: { increment: 1 } } });
  });
}
