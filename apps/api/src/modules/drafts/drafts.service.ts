import type { Draft } from "@prisma/client";
import { DraftStatus, normalizeContent } from "@noteschain/shared";
import type { CreateDraftInput, UpdateDraftInput, DraftInput } from "@noteschain/validation";
import { draftInputSchema } from "@noteschain/validation";
import { prisma } from "../../lib/prisma.js";
import { Errors } from "../../lib/apiError.js";
import { DELETABLE_DRAFT_STATUSES, EDITABLE_DRAFT_STATUSES, transitionDraft } from "./stateMachine.js";
import { createPublicationFromApprovedSubmission } from "../publications/publishing.service.js";

const AUTOSAVE_VERSION_THROTTLE_MS = 30_000;

/**
 * Draft.status is capped at APPROVED by design (see stateMachine.ts) — once
 * a Publication exists, ITS status (CHAIN_PENDING → ... → PUBLISHED) is the
 * true lifecycle state, and Draft.status is never updated to reflect it.
 * Every read path that displays status to the author must therefore prefer
 * the linked Publication's status when one exists, or a fully published
 * draft shows as "Approved — ready to publish" forever.
 */
export function toDraftDTO(draft: Draft & { publication?: { status: DraftStatus } | null }) {
  return {
    id: draft.id,
    title: draft.title,
    content: draft.content,
    contentFormat: draft.contentFormat,
    tags: draft.tags,
    identityMode: draft.identityMode,
    publicIdentityId: draft.publicIdentityId,
    discoverability: draft.discoverability,
    status: draft.publication?.status ?? draft.status,
    lastSavedAt: draft.lastSavedAt,
    submittedAt: draft.submittedAt,
    createdAt: draft.createdAt,
    updatedAt: draft.updatedAt,
  };
}

export async function listDraftsForUser(userId: string) {
  return prisma.draft.findMany({
    where: { userId },
    orderBy: { updatedAt: "desc" },
    include: { publication: { select: { status: true } } },
  });
}

export async function createDraft(userId: string, input: CreateDraftInput) {
  return prisma.draft.create({
    data: {
      userId,
      title: input.title ?? "",
      content: input.content ?? "",
      tags: input.tags ?? [],
      identityMode: input.identityMode,
      publicIdentityId: input.publicIdentityId ?? null,
      discoverability: input.discoverability,
    },
  });
}

async function getOwnedDraftOrThrow(userId: string, draftId: string): Promise<Draft> {
  const draft = await prisma.draft.findUnique({ where: { id: draftId } });
  if (!draft) throw Errors.notFound("Draft not found.");
  if (draft.userId !== userId) throw Errors.forbidden("You do not own this draft.");
  return draft;
}

export async function getDraft(userId: string, draftId: string) {
  const draft = await prisma.draft.findUnique({
    where: { id: draftId },
    include: { publication: { select: { status: true } } },
  });
  if (!draft) throw Errors.notFound("Draft not found.");
  if (draft.userId !== userId) throw Errors.forbidden("You do not own this draft.");
  return draft;
}

function requireEditable(draft: Draft) {
  if (!EDITABLE_DRAFT_STATUSES.includes(draft.status as DraftStatus)) {
    throw Errors.conflict(`This draft can't be edited while it's ${draft.status}.`);
  }
}

async function verifyIdentityOwnership(userId: string, publicIdentityId: string | null | undefined) {
  if (!publicIdentityId) return;
  const identity = await prisma.publicIdentity.findUnique({ where: { id: publicIdentityId } });
  if (!identity || identity.userId !== userId) {
    throw Errors.badRequest("Selected identity does not belong to you.");
  }
}

async function maybeCreateVersion(draft: Draft, throttleMs: number | null) {
  if (draft.title === "" && draft.content === "") return;

  const latest = await prisma.draftVersion.findFirst({
    where: { draftId: draft.id },
    orderBy: { versionNumber: "desc" },
  });

  if (latest && latest.title === draft.title && latest.content === draft.content) {
    return; // content identical to the last saved version — nothing to record
  }

  if (throttleMs !== null && latest && Date.now() - latest.createdAt.getTime() < throttleMs) {
    return;
  }

  await prisma.draftVersion.create({
    data: {
      draftId: draft.id,
      versionNumber: (latest?.versionNumber ?? 0) + 1,
      title: draft.title,
      content: draft.content,
    },
  });

  await pruneOldVersions(draft.id);
}

/**
 * Keeps only the newest MAX_VERSIONS_PER_DRAFT snapshots.
 *
 * This was harmless when a body was capped at 600 bytes — an hour of editing
 * cost a few hundred KB at worst. With notes up to 20,000 characters, an
 * unbounded version history means ~120 snapshots per hour of active editing,
 * each holding a full copy of the note, and a client that saves aggressively
 * can drive it much higher. The history is a safety net for the author, not
 * an archive; the most recent 50 restore points are what that needs.
 */
const MAX_VERSIONS_PER_DRAFT = 50;

async function pruneOldVersions(draftId: string) {
  const survivors = await prisma.draftVersion.findMany({
    where: { draftId },
    orderBy: { versionNumber: "desc" },
    take: MAX_VERSIONS_PER_DRAFT,
    select: { versionNumber: true },
  });
  if (survivors.length < MAX_VERSIONS_PER_DRAFT) return;

  const oldest = survivors[survivors.length - 1]!.versionNumber;
  await prisma.draftVersion.deleteMany({
    where: { draftId, versionNumber: { lt: oldest } },
  });
}

async function applyDraftPatch(
  userId: string,
  draftId: string,
  patch: UpdateDraftInput,
  options: { throttleVersioning: boolean },
) {
  const draft = await getOwnedDraftOrThrow(userId, draftId);
  requireEditable(draft);

  if (patch.publicIdentityId !== undefined) {
    await verifyIdentityOwnership(userId, patch.publicIdentityId);
  }

  const updated = await prisma.draft.update({
    where: { id: draftId },
    data: {
      title: patch.title,
      content: patch.content,
      tags: patch.tags,
      identityMode: patch.identityMode,
      publicIdentityId: patch.publicIdentityId,
      discoverability: patch.discoverability,
      lastSavedAt: new Date(),
    },
  });

  await maybeCreateVersion(updated, options.throttleVersioning ? AUTOSAVE_VERSION_THROTTLE_MS : null);
  return updated;
}

export async function autosaveDraft(userId: string, draftId: string, patch: UpdateDraftInput) {
  return applyDraftPatch(userId, draftId, patch, { throttleVersioning: true });
}

export async function updateDraft(userId: string, draftId: string, patch: UpdateDraftInput) {
  return applyDraftPatch(userId, draftId, patch, { throttleVersioning: false });
}

export async function deleteDraft(userId: string, draftId: string) {
  const draft = await getOwnedDraftOrThrow(userId, draftId);
  if (!DELETABLE_DRAFT_STATUSES.includes(draft.status as DraftStatus)) {
    throw Errors.conflict(`This draft can't be deleted while it's ${draft.status}. Withdraw it first.`);
  }
  await prisma.draft.delete({ where: { id: draftId } });
}

export async function listDraftVersions(userId: string, draftId: string) {
  await getOwnedDraftOrThrow(userId, draftId);
  return prisma.draftVersion.findMany({ where: { draftId }, orderBy: { versionNumber: "desc" } });
}

export async function restoreDraftVersion(userId: string, draftId: string, versionId: string) {
  const draft = await getOwnedDraftOrThrow(userId, draftId);
  requireEditable(draft);

  const version = await prisma.draftVersion.findUnique({ where: { id: versionId } });
  if (!version || version.draftId !== draftId) {
    throw Errors.notFound("Draft version not found.");
  }

  const updated = await prisma.draft.update({
    where: { id: draftId },
    data: { title: version.title, content: version.content, lastSavedAt: new Date() },
  });
  await maybeCreateVersion(updated, null);
  return updated;
}

/** Validates the draft's current content against the strict submission
 * schema — a draft can be saved in an incomplete state, but not submitted. */
async function validateForSubmission(userId: string, draft: Draft): Promise<DraftInput> {
  const parsed = draftInputSchema.safeParse({
    title: draft.title,
    // Normalised exactly once, here, on the way into the permanent record:
    // CRLF collapsed, C0 controls stripped (Postgres TEXT rejects NUL
    // outright), NFC applied. Deliberately NOT done inside the hash
    // function — hashing normalised-on-the-fly input would make
    // verification depend on the runtime's Unicode tables, so a dependency
    // bump could stop old notes verifying. Store what we hash; hash what we
    // store.
    content: normalizeContent(draft.content),
    tags: draft.tags,
    identityMode: draft.identityMode,
    publicIdentityId: draft.publicIdentityId,
    discoverability: draft.discoverability,
  });
  if (!parsed.success) {
    throw Errors.badRequest("This draft isn't ready to submit.", parsed.error.flatten());
  }
  await verifyIdentityOwnership(userId, parsed.data.publicIdentityId);
  return parsed.data;
}

export async function submitDraft(userId: string, draftId: string) {
  const draft = await getOwnedDraftOrThrow(userId, draftId);
  const validated = await validateForSubmission(userId, draft);
  const nextStatus = transitionDraft(draft.status as DraftStatus, "SUBMIT");

  return prisma.$transaction(async (tx) => {
    const updatedDraft = await tx.draft.update({
      where: { id: draftId },
      data: { status: nextStatus, submittedAt: new Date() },
    });
    const submission = await tx.submission.create({
      data: {
        draftId,
        submittedByUserId: userId,
        titleSnapshot: validated.title,
        contentSnapshot: validated.content,
        // Snapshotted from the draft, not hardcoded: a draft written before
        // markdown shipped is PLAINTEXT and must stay that way through
        // approval, or its asterisks change meaning on the way to being
        // permanent.
        contentFormatSnapshot: draft.contentFormat,
        tagsSnapshot: validated.tags,
        identityModeSnapshot: validated.identityMode,
        publicIdentityIdSnapshot: validated.publicIdentityId ?? null,
        discoverabilitySnapshot: validated.discoverability,
        status: DraftStatus.PENDING_REVIEW,
      },
    });
    return { draft: updatedDraft, submission };
  });
}

/**
 * The author's explicit acknowledgement of the irreversible-publication
 * warning (product spec §9) — the moment that actually queues the
 * blockchain publishing job. Moderator approval alone does not do this.
 */
export async function confirmPublish(userId: string, draftId: string) {
  const draft = await getOwnedDraftOrThrow(userId, draftId);
  if (draft.status !== DraftStatus.APPROVED) {
    throw Errors.conflict("Only an approved draft can be confirmed for publishing.");
  }

  return prisma.$transaction(async (tx) => {
    const submission = await tx.submission.findFirst({
      where: { draftId, status: DraftStatus.APPROVED },
      orderBy: { decidedAt: "desc" },
    });
    if (!submission) {
      throw Errors.conflict("No approved submission found for this draft.");
    }
    return createPublicationFromApprovedSubmission(tx, submission, userId);
  });
}

export async function withdrawDraft(userId: string, draftId: string) {
  const draft = await getOwnedDraftOrThrow(userId, draftId);
  const nextStatus = transitionDraft(draft.status as DraftStatus, "WITHDRAW");

  return prisma.$transaction(async (tx) => {
    await tx.submission.deleteMany({
      where: { draftId, status: DraftStatus.PENDING_REVIEW, decidedAt: null },
    });
    return tx.draft.update({ where: { id: draftId }, data: { status: nextStatus, submittedAt: null } });
  });
}
