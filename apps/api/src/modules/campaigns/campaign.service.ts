import { randomBytes } from "node:crypto";
import { AccountStatus, Permission, hasPermission } from "@noteschain/shared";
import type { CampaignStatus, Prisma, PushPlatform } from "@prisma/client";
import { campaignScheduleSchema, type CreateCampaignInput } from "@noteschain/validation";
import { prisma } from "../../lib/prisma.js";
import { Errors } from "../../lib/apiError.js";
import { recordAudit } from "../../lib/audit.js";

const APPROVAL_DELAY_MS = 15 * 60 * 1000;

function assertCreator(roles: readonly string[]) { if (!hasPermission(roles, Permission.CREATE_CAMPAIGN)) throw Errors.forbidden(); }
function assertApprover(roles: readonly string[]) { if (!hasPermission(roles, Permission.APPROVE_CAMPAIGN)) throw Errors.forbidden(); }
function randomDeliveryToken() { return randomBytes(24).toString("base64url"); }

type Audience = CreateCampaignInput["audience"];
function installationWhere(audience: Audience): Prisma.PushInstallationWhereInput {
  const now = new Date();
  const createdBefore = audience.minAgeDays ? new Date(now.getTime() - audience.minAgeDays * 86_400_000) : undefined;
  const inactiveBefore = audience.inactiveDays ? new Date(now.getTime() - audience.inactiveDays * 86_400_000) : undefined;
  return {
    productOptIn: true,
    permissionGranted: true,
    timeZone: { not: null },
    ...(audience.platform ? { platform: audience.platform as PushPlatform } : {}),
    ...(inactiveBefore ? { lastForegroundAt: { lte: inactiveBefore } } : {}),
    ...(audience.target === "ANONYMOUS" ? { userId: null, ...(createdBefore ? { firstSeenAt: { lte: createdBefore } } : {}) } : {
      user: {
        status: AccountStatus.ACTIVE,
        ...(createdBefore ? { createdAt: { lte: createdBefore } } : {}),
        ...(audience.hasPublished === undefined ? {} : { publications: audience.hasPublished ? { some: { status: "PUBLISHED" } } : { none: { status: "PUBLISHED" } } }),
      },
    }),
  };
}

async function eligibleInstallationIds(audience: Audience) {
  const installations = await prisma.pushInstallation.findMany({ where: installationWhere(audience), select: { id: true } });
  const now = new Date();
  const [daily, weekly, monthly] = await Promise.all([
    prisma.campaignRecipient.findMany({ where: { endpointKind: "PUSH_INSTALLATION", acceptedAt: { gte: new Date(now.getTime() - 86_400_000) } }, select: { endpointId: true } }),
    prisma.campaignRecipient.findMany({ where: { endpointKind: "PUSH_INSTALLATION", acceptedAt: { gte: new Date(now.getTime() - 7 * 86_400_000) } }, select: { endpointId: true } }),
    prisma.campaignRecipient.findMany({ where: { endpointKind: "PUSH_INSTALLATION", acceptedAt: { gte: new Date(now.getTime() - 30 * 86_400_000) } }, select: { endpointId: true } }),
  ]);
  const count = (rows: { endpointId: string }[]) => rows.reduce<Map<string, number>>((result, row) => result.set(row.endpointId, (result.get(row.endpointId) ?? 0) + 1), new Map());
  const d = count(daily); const w = count(weekly); const m = count(monthly);
  return installations.map(({ id }) => id).filter((id) => (d.get(id) ?? 0) < 1 && (w.get(id) ?? 0) < 3 && (m.get(id) ?? 0) < 8);
}

export async function createCampaign(actorId: string, roles: readonly string[], input: CreateCampaignInput, ipAddress?: string) {
  assertCreator(roles);
  const campaign = await prisma.$transaction(async (tx) => {
    const created = await tx.campaign.create({ data: { name: input.name, objective: input.objective } });
    const version = await tx.campaignVersion.create({
      data: { campaignId: created.id, version: 1, title: input.title, body: input.body, deepLink: input.deepLink, audience: input.audience as Prisma.InputJsonValue, schedule: { ...input.schedule, scheduledAt: input.schedule.scheduledAt.toISOString() } as Prisma.InputJsonValue, createdById: actorId },
    });
    return tx.campaign.update({ where: { id: created.id }, data: { activeVersionId: version.id }, include: { activeVersion: true } });
  });
  await recordAudit({ actorUserId: actorId, action: "CAMPAIGN_CREATED", targetType: "Campaign", targetId: campaign.id, metadata: { objective: input.objective }, ipAddress });
  return campaign;
}

export async function previewCampaign(actorRoles: readonly string[], input: Pick<CreateCampaignInput, "audience">) {
  assertCreator(actorRoles);
  const eligible = (await eligibleInstallationIds(input.audience)).length;
  return { eligible, excluded: { frequencyCap: "Product caps and quiet-hour checks are applied again immediately before send." } };
}

export async function submitCampaign(actorId: string, roles: readonly string[], campaignId: string, ipAddress?: string) {
  assertCreator(roles);
  const campaign = await prisma.campaign.findUnique({ where: { id: campaignId }, include: { activeVersion: true } });
  if (!campaign || !campaign.activeVersion) throw Errors.notFound("Campaign not found.");
  if (campaign.activeVersion.createdById !== actorId) throw Errors.forbidden("Only the creator can submit this campaign.");
  if (campaign.status !== "DRAFT") throw Errors.conflict("Only draft campaigns can be submitted.");
  await prisma.campaign.update({ where: { id: campaignId }, data: { status: "PENDING_APPROVAL" } });
  await recordAudit({ actorUserId: actorId, action: "CAMPAIGN_SUBMITTED", targetType: "Campaign", targetId: campaignId, ipAddress });
}

export async function approveCampaign(actorId: string, roles: readonly string[], campaignId: string, ipAddress?: string) {
  assertApprover(roles);
  const campaign = await prisma.campaign.findUnique({ where: { id: campaignId }, include: { activeVersion: true } });
  if (!campaign || !campaign.activeVersion) throw Errors.notFound("Campaign not found.");
  if (campaign.status !== "PENDING_APPROVAL") throw Errors.conflict("Campaign is not awaiting approval.");
  if (campaign.activeVersion.createdById === actorId) throw Errors.forbidden("Campaign creators cannot approve their own campaign.");
  const schedule = campaignScheduleSchema.parse(campaign.activeVersion.schedule);
  if (schedule.scheduledAt.getTime() < Date.now() + APPROVAL_DELAY_MS) throw Errors.badRequest("Campaign launch must be at least 15 minutes after approval.");
  const installationIds = await eligibleInstallationIds(campaign.activeVersion.audience as unknown as Audience);
  await prisma.$transaction(async (tx) => {
    await tx.campaignVersion.update({ where: { id: campaign.activeVersion!.id }, data: { approvedById: actorId, approvedAt: new Date(), frozenAt: new Date() } });
    await tx.campaign.update({ where: { id: campaignId }, data: { status: "SCHEDULED" } });
    const run = await tx.campaignRun.create({ data: { campaignId, versionId: campaign.activeVersion!.id, scheduledAt: schedule.scheduledAt } });
    if (installationIds.length) await tx.campaignRecipient.createMany({ data: installationIds.map((endpointId) => ({ runId: run.id, endpointId, endpointKind: "PUSH_INSTALLATION", deliveryToken: randomDeliveryToken() })), skipDuplicates: true });
  });
  await recordAudit({ actorUserId: actorId, action: "CAMPAIGN_APPROVED", targetType: "Campaign", targetId: campaignId, metadata: { recipientSnapshot: installationIds.length }, ipAddress });
}

export async function changeCampaignStatus(actorId: string, roles: readonly string[], campaignId: string, status: Extract<CampaignStatus, "PAUSED" | "CANCELLED">, ipAddress?: string) {
  if (!hasPermission(roles, Permission.APPROVE_CAMPAIGN) && !hasPermission(roles, Permission.MANAGE_PLATFORM)) throw Errors.forbidden();
  const campaign = await prisma.campaign.findUnique({ where: { id: campaignId } });
  if (!campaign) throw Errors.notFound("Campaign not found.");
  if (["COMPLETED", "CANCELLED"].includes(campaign.status)) throw Errors.conflict("Completed or cancelled campaigns cannot be changed.");
  await prisma.campaign.update({ where: { id: campaignId }, data: { status } });
  await recordAudit({ actorUserId: actorId, action: `CAMPAIGN_${status}`, targetType: "Campaign", targetId: campaignId, ipAddress });
}

export async function listCampaigns() {
  return prisma.campaign.findMany({ orderBy: { updatedAt: "desc" }, include: { activeVersion: { select: { title: true, body: true, deepLink: true, approvedAt: true, createdBy: { select: { email: true } }, approvedBy: { select: { email: true } } }, }, _count: { select: { runs: true } } } });
}
