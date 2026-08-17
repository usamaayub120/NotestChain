import type { Prisma } from "@prisma/client";
import { DraftStatus, ModerationAction } from "@noteschain/shared";
import type { ModerationDecisionInput } from "@noteschain/validation";
import { EmailKind, buildEmailJobData } from "@noteschain/email";
import { prisma } from "../../lib/prisma.js";
import { Errors } from "../../lib/apiError.js";
import { recordAudit } from "../../lib/audit.js";
import { env } from "../../config/env.js";
import { transitionDraft, type DraftEvent } from "../drafts/stateMachine.js";

const ACTION_TO_EVENT: Record<ModerationAction, DraftEvent> = {
  [ModerationAction.APPROVE]: "APPROVE",
  [ModerationAction.REJECT]: "REJECT",
  [ModerationAction.REQUEST_CHANGES]: "REQUEST_CHANGES",
};

export async function listPendingSubmissions() {
  return prisma.submission.findMany({
    where: { status: DraftStatus.PENDING_REVIEW },
    orderBy: { createdAt: "asc" },
    include: {
      submittedBy: { select: { id: true, email: true, status: true, createdAt: true } },
    },
  });
}

export async function getSubmissionDetail(submissionId: string) {
  const submission = await prisma.submission.findUnique({
    where: { id: submissionId },
    include: {
      submittedBy: { select: { id: true, email: true, status: true, createdAt: true } },
      decisions: { orderBy: { createdAt: "desc" }, include: { moderator: { select: { id: true, email: true } } } },
    },
  });
  if (!submission) throw Errors.notFound("Submission not found.");

  const priorSubmissions = await prisma.submission.findMany({
    where: { draftId: submission.draftId, id: { not: submission.id } },
    orderBy: { createdAt: "desc" },
  });

  const possibleDuplicates = await prisma.submission.findMany({
    where: {
      id: { not: submission.id },
      draftId: { not: submission.draftId },
      titleSnapshot: submission.titleSnapshot,
      contentSnapshot: submission.contentSnapshot,
    },
    select: { id: true, draftId: true, submittedByUserId: true, createdAt: true, status: true },
    take: 5,
  });

  return { submission, priorSubmissions, possibleDuplicates };
}

/** Builds the notification email for a decision — null for actions that don't send one (there are none today, but the shape stays honest about that). */
function buildDecisionEmailJobData(action: ModerationAction, submissionTitle: string, draftId: string, reason: string) {
  switch (action) {
    case ModerationAction.APPROVE:
      return {
        kind: EmailKind.PUBLICATION_APPROVED,
        data: buildEmailJobData(EmailKind.PUBLICATION_APPROVED, {
          publicationTitle: submissionTitle,
          draftEditUrl: `${env.PUBLIC_WEB_ORIGIN}/drafts/${draftId}/edit`,
        }),
      };
    case ModerationAction.REJECT:
      return {
        kind: EmailKind.PUBLICATION_REJECTED,
        data: buildEmailJobData(EmailKind.PUBLICATION_REJECTED, {
          publicationTitle: submissionTitle,
          reason,
          newDraftUrl: `${env.PUBLIC_WEB_ORIGIN}/drafts`,
        }),
      };
    case ModerationAction.REQUEST_CHANGES:
      return {
        kind: EmailKind.PUBLICATION_CHANGES_REQUESTED,
        data: buildEmailJobData(EmailKind.PUBLICATION_CHANGES_REQUESTED, {
          publicationTitle: submissionTitle,
          reason,
          draftEditUrl: `${env.PUBLIC_WEB_ORIGIN}/drafts/${draftId}/edit`,
        }),
      };
  }
}

export async function decideSubmission(
  moderatorUserId: string,
  submissionId: string,
  action: ModerationAction,
  input: ModerationDecisionInput,
  ipAddress?: string,
) {
  const submission = await prisma.submission.findUnique({
    where: { id: submissionId },
    include: { submittedBy: { select: { id: true, email: true } } },
  });
  if (!submission) throw Errors.notFound("Submission not found.");
  if (submission.status !== DraftStatus.PENDING_REVIEW) {
    throw Errors.conflict("This submission has already been decided.");
  }

  const draft = await prisma.draft.findUniqueOrThrow({ where: { id: submission.draftId } });
  const nextStatus = transitionDraft(draft.status as DraftStatus, ACTION_TO_EVENT[action]);
  const emailJob = buildDecisionEmailJobData(action, submission.titleSnapshot, draft.id, input.reason);

  const result = await prisma.$transaction(async (tx) => {
    const updatedSubmission = await tx.submission.update({
      where: { id: submissionId },
      data: { status: nextStatus, decidedAt: new Date() },
    });
    await tx.draft.update({ where: { id: draft.id }, data: { status: nextStatus } });
    const decision = await tx.moderationDecision.create({
      data: {
        submissionId,
        moderatorUserId,
        action,
        reason: input.reason,
        note: input.note,
        flaggedPii: input.flaggedPii ?? false,
        flaggedAbuse: input.flaggedAbuse ?? false,
      },
    });
    // Enqueued in the same transaction as the decision itself — if this
    // roll back, the author was never notified of a decision that also
    // never happened, rather than a notification surviving a decision that
    // didn't stick (or vice versa).
    await tx.emailJob.create({
      data: {
        kind: emailJob.kind,
        toEmail: submission.submittedBy.email,
        toUserId: submission.submittedBy.id,
        // buildEmailJobData returns Record<string, unknown> rather than
        // Prisma's InputJsonValue, deliberately — packages/email stays
        // Prisma-free. It already validated this shape against the kind's
        // zod schema, which is the guarantee that makes this cast safe.
        data: emailJob.data as Prisma.InputJsonValue,
      },
    });
    return { submission: updatedSubmission, decision };
  });

  await recordAudit({
    actorUserId: moderatorUserId,
    action: `MODERATION_${action}`,
    targetType: "Submission",
    targetId: submissionId,
    metadata: { reason: input.reason, flaggedPii: input.flaggedPii, flaggedAbuse: input.flaggedAbuse },
    ipAddress,
  });

  return result;
}
