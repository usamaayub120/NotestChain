import { DraftStatus, ModerationAction } from "@noteschain/shared";
import type { ModerationDecisionInput } from "@noteschain/validation";
import { prisma } from "../../lib/prisma.js";
import { Errors } from "../../lib/apiError.js";
import { recordAudit } from "../../lib/audit.js";
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

export async function decideSubmission(
  moderatorUserId: string,
  submissionId: string,
  action: ModerationAction,
  input: ModerationDecisionInput,
  ipAddress?: string,
) {
  const submission = await prisma.submission.findUnique({ where: { id: submissionId } });
  if (!submission) throw Errors.notFound("Submission not found.");
  if (submission.status !== DraftStatus.PENDING_REVIEW) {
    throw Errors.conflict("This submission has already been decided.");
  }

  const draft = await prisma.draft.findUniqueOrThrow({ where: { id: submission.draftId } });
  const nextStatus = transitionDraft(draft.status as DraftStatus, ACTION_TO_EVENT[action]);

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
