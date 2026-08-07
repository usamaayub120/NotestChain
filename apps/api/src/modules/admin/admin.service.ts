import { ChainStatus, OutboxStatus } from "@noteschain/shared";
import { CommentReportResolution, ReportResolution, ReportStatus } from "@prisma/client";
import type { DelistPublicationInput, ResolveCommentReportInput, ResolveReportInput } from "@noteschain/validation";
import { prisma } from "../../lib/prisma.js";
import { Errors } from "../../lib/apiError.js";
import { recordAudit } from "../../lib/audit.js";
import { revokeAllSessionsForUser } from "../auth/session.service.js";

export async function delistPublication(
  adminUserId: string,
  publicationId: string,
  input: DelistPublicationInput,
  ipAddress?: string,
) {
  const publication = await prisma.publication.findUnique({ where: { id: publicationId } });
  if (!publication) throw Errors.notFound("Publication not found.");
  if (!publication.isPlatformVisible) throw Errors.conflict("This publication is already delisted.");

  const updated = await prisma.publication.update({
    where: { id: publicationId },
    data: { isPlatformVisible: false, delistingReason: input.reason },
  });

  await recordAudit({
    actorUserId: adminUserId,
    action: "PUBLICATION_DELISTED",
    targetType: "Publication",
    targetId: publicationId,
    metadata: { reason: input.reason },
    ipAddress,
  });

  return updated;
}

export async function restorePublicationListing(adminUserId: string, publicationId: string, ipAddress?: string) {
  const publication = await prisma.publication.findUnique({ where: { id: publicationId } });
  if (!publication) throw Errors.notFound("Publication not found.");
  if (publication.isPlatformVisible) throw Errors.conflict("This publication isn't delisted.");

  const updated = await prisma.publication.update({
    where: { id: publicationId },
    data: { isPlatformVisible: true, delistingReason: null },
  });

  await recordAudit({
    actorUserId: adminUserId,
    action: "PUBLICATION_LISTING_RESTORED",
    targetType: "Publication",
    targetId: publicationId,
    ipAddress,
  });

  return updated;
}

export async function listReports(status?: ReportStatus) {
  return prisma.report.findMany({
    where: status ? { status } : undefined,
    orderBy: { createdAt: "desc" },
    include: {
      publication: { select: { id: true, title: true, isPlatformVisible: true } },
      reporter: { select: { id: true, email: true } },
    },
  });
}

/**
 * Resolving with action=DELISTED also delists the reported publication, in
 * the same transaction — a report resolution that claims to have delisted
 * something must not be able to silently fail to actually do so.
 */
export async function resolveReport(
  adminUserId: string,
  reportId: string,
  input: ResolveReportInput,
  ipAddress?: string,
) {
  const report = await prisma.report.findUnique({
    where: { id: reportId },
    include: { publication: { select: { id: true, privateAuthorUserId: true } } },
  });
  if (!report) throw Errors.notFound("Report not found.");
  if (report.status !== ReportStatus.OPEN) throw Errors.conflict("This report has already been resolved.");

  const resolvedAt = new Date();
  const updated = await prisma.$transaction(async (tx) => {
    const resolvedReport = await tx.report.update({
      where: { id: reportId },
      data: {
        status: ReportStatus.RESOLVED,
        resolution: input.action as ReportResolution,
        resolutionNote: input.resolutionNote,
        resolvedByUserId: adminUserId,
        resolvedAt,
      },
    });

    if (input.action === ReportResolution.DELISTED) {
      await tx.publication.updateMany({
        where: { id: report.publicationId, isPlatformVisible: true },
        data: {
          isPlatformVisible: false,
          delistingReason: input.resolutionNote ?? `Delisted following report ${reportId}.`,
        },
      });
    }

    if (input.action === ReportResolution.USER_SUSPENDED) {
      await tx.user.update({
        where: { id: report.publication.privateAuthorUserId },
        data: { status: "SUSPENDED" },
      });
    }

    return resolvedReport;
  });

  if (input.action === ReportResolution.USER_SUSPENDED) {
    // Outside the transaction — it deletes Session rows, which don't need
    // to be atomic with the report/user update, and keeping it out avoids
    // holding the transaction open across an extra round trip.
    await revokeAllSessionsForUser(report.publication.privateAuthorUserId);
  }

  await recordAudit({
    actorUserId: adminUserId,
    action: `REPORT_RESOLVED_${input.action}`,
    targetType: "Report",
    targetId: reportId,
    metadata: { publicationId: report.publicationId, resolutionNote: input.resolutionNote },
    ipAddress,
  });

  return updated;
}

export async function listCommentReports(status?: ReportStatus) {
  return prisma.commentReport.findMany({
    where: status ? { status } : undefined,
    orderBy: { createdAt: "desc" },
    include: {
      comment: { select: { id: true, body: true, isVisible: true, publicationId: true } },
      reporter: { select: { id: true, email: true } },
    },
  });
}

/**
 * Resolving with action=COMMENT_REMOVED soft-deletes the comment in the
 * same transaction, mirroring resolveReport's DELISTED handling — a
 * resolution that claims to have removed something must not be able to
 * silently fail to actually do so.
 */
export async function resolveCommentReport(
  adminUserId: string,
  reportId: string,
  input: ResolveCommentReportInput,
  ipAddress?: string,
) {
  const report = await prisma.commentReport.findUnique({
    where: { id: reportId },
    include: { comment: { select: { id: true, authorUserId: true } } },
  });
  if (!report) throw Errors.notFound("Report not found.");
  if (report.status !== ReportStatus.OPEN) throw Errors.conflict("This report has already been resolved.");

  const resolvedAt = new Date();
  const updated = await prisma.$transaction(async (tx) => {
    const resolvedReport = await tx.commentReport.update({
      where: { id: reportId },
      data: {
        status: ReportStatus.RESOLVED,
        resolution: input.action as CommentReportResolution,
        resolutionNote: input.resolutionNote,
        resolvedByUserId: adminUserId,
        resolvedAt,
      },
    });

    if (input.action === CommentReportResolution.COMMENT_REMOVED) {
      await tx.comment.updateMany({
        where: { id: report.commentId, isVisible: true },
        data: {
          isVisible: false,
          removalReason: input.resolutionNote ?? `Removed following report ${reportId}.`,
        },
      });
    }

    if (input.action === CommentReportResolution.USER_SUSPENDED) {
      await tx.user.update({
        where: { id: report.comment.authorUserId },
        data: { status: "SUSPENDED" },
      });
    }

    return resolvedReport;
  });

  if (input.action === CommentReportResolution.USER_SUSPENDED) {
    await revokeAllSessionsForUser(report.comment.authorUserId);
  }

  await recordAudit({
    actorUserId: adminUserId,
    action: `COMMENT_REPORT_RESOLVED_${input.action}`,
    targetType: "CommentReport",
    targetId: reportId,
    metadata: { commentId: report.commentId, resolutionNote: input.resolutionNote },
    ipAddress,
  });

  return updated;
}

export async function getViewBreakdown(days = 30) {
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  const bySource = await prisma.publicationView.groupBy({
    by: ["utmSource"],
    where: { createdAt: { gte: since } },
    _count: { _all: true },
    orderBy: { _count: { utmSource: "desc" } },
  });

  const total = await prisma.publicationView.count({ where: { createdAt: { gte: since } } });

  return {
    total,
    bySource: bySource.map((row) => ({ utmSource: row.utmSource ?? "(direct)", count: row._count._all })),
  };
}

export async function listMostViewedPublications(days = 30, limit = 20) {
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  const grouped = await prisma.publicationView.groupBy({
    by: ["publicationId"],
    where: { createdAt: { gte: since } },
    _count: { _all: true },
    orderBy: { _count: { publicationId: "desc" } },
    take: limit,
  });

  const publications = await prisma.publication.findMany({
    where: { id: { in: grouped.map((row) => row.publicationId) } },
    select: { id: true, title: true, isPlatformVisible: true },
  });
  const byId = new Map(publications.map((pub) => [pub.id, pub]));

  return grouped.map((row) => ({
    publication: byId.get(row.publicationId) ?? null,
    views: row._count._all,
  }));
}

export interface AuditLogQuery {
  page: number;
  pageSize: number;
  action?: string;
  targetType?: string;
}

export async function listAuditLog(query: AuditLogQuery) {
  const where = {
    ...(query.action ? { action: query.action } : {}),
    ...(query.targetType ? { targetType: query.targetType } : {}),
  };

  const [items, total] = await Promise.all([
    prisma.auditLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (query.page - 1) * query.pageSize,
      take: query.pageSize,
      include: { actor: { select: { id: true, email: true } } },
    }),
    prisma.auditLog.count({ where }),
  ]);

  return { items, total };
}

export interface BlockchainJobsQuery {
  page: number;
  pageSize: number;
  status?: OutboxStatus;
}

export async function listBlockchainJobs(query: BlockchainJobsQuery) {
  const where = query.status ? { status: query.status } : undefined;

  const [items, total] = await Promise.all([
    prisma.workerJob.findMany({
      where,
      orderBy: { updatedAt: "desc" },
      skip: (query.page - 1) * query.pageSize,
      take: query.pageSize,
    }),
    prisma.workerJob.count({ where }),
  ]);

  const publications = await prisma.publication.findMany({
    where: { id: { in: items.map((job) => job.publicationId) } },
    select: { id: true, title: true, status: true, chainRecord: { select: { chainStatus: true, lastError: true } } },
  });
  const byId = new Map(publications.map((pub) => [pub.id, pub]));

  return { items: items.map((job) => ({ ...job, publication: byId.get(job.publicationId) ?? null })), total };
}

/**
 * Manual dead-letter recovery: resets a FAILED job back to PENDING with a
 * clean attempt counter, and un-sticks its chain record if it had been
 * marked FAILED_PERMANENT. This is an explicit admin override — the worker
 * itself never does this on its own (see ARCHITECTURE.md §3.6).
 */
export async function retryBlockchainJob(adminUserId: string, jobId: string, ipAddress?: string) {
  const job = await prisma.workerJob.findUnique({ where: { id: jobId } });
  if (!job) throw Errors.notFound("Job not found.");
  if (job.status !== OutboxStatus.FAILED) throw Errors.conflict("Only failed jobs can be retried.");

  const updated = await prisma.$transaction(async (tx) => {
    const resetJob = await tx.workerJob.update({
      where: { id: jobId },
      data: { status: OutboxStatus.PENDING, attempts: 0, lastError: null, nextAttemptAt: new Date() },
    });
    await tx.outboxEvent.update({
      where: { id: job.outboxEventId },
      data: { status: OutboxStatus.PENDING, attempts: 0, lastError: null },
    });
    await tx.publicationChainRecord.updateMany({
      where: { publicationId: job.publicationId },
      data: { chainStatus: ChainStatus.QUEUED, lastError: null },
    });
    return resetJob;
  });

  await recordAudit({
    actorUserId: adminUserId,
    action: "BLOCKCHAIN_JOB_RETRIED",
    targetType: "WorkerJob",
    targetId: jobId,
    metadata: { publicationId: job.publicationId },
    ipAddress,
  });

  return updated;
}
