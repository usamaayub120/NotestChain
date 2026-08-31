import { prisma } from "../lib/prisma.js";

/** Keep only run aggregates after the 90-day recipient retention window. */
export async function pruneCampaignData(): Promise<void> {
  const cutoff = new Date(Date.now() - 90 * 86_400_000);
  await prisma.$transaction([
    prisma.campaignRecipient.deleteMany({ where: { createdAt: { lt: cutoff } } }),
    prisma.pushInstallation.deleteMany({ where: { userId: null, lastSeenAt: { lt: cutoff } } }),
  ]);
}
