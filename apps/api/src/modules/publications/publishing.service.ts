import type { Prisma, Submission } from "@prisma/client";
import { contentHashHex } from "@noteschain/blockchain-client";
import { Errors } from "../../lib/apiError.js";
import { env } from "../../config/env.js";

const EXCERPT_MAX_CHARS = 140;

export function computeExcerpt(content: string, maxChars = EXCERPT_MAX_CHARS): string {
  if (content.length <= maxChars) return content;
  return `${content.slice(0, maxChars).trimEnd()}…`;
}

/**
 * Turns an approved Submission into a Publication row + an outbox event, in
 * the same transaction — see ARCHITECTURE.md §6, step 2. Idempotent:
 * Publication.sourceDraftId is unique, so calling this twice for the same
 * draft throws a conflict instead of creating a duplicate.
 */
export async function createPublicationFromApprovedSubmission(
  tx: Prisma.TransactionClient,
  submission: Submission,
  privateAuthorUserId: string,
) {
  const existing = await tx.publication.findUnique({ where: { sourceDraftId: submission.draftId } });
  if (existing) {
    throw Errors.conflict("This draft has already been published.");
  }

  const contentHash = contentHashHex(submission.titleSnapshot, submission.contentSnapshot);

  const publication = await tx.publication.create({
    data: {
      sourceDraftId: submission.draftId,
      privateAuthorUserId,
      publicIdentityId: submission.publicIdentityIdSnapshot,
      identityMode: submission.identityModeSnapshot,
      discoverability: submission.discoverabilitySnapshot,
      title: submission.titleSnapshot,
      content: submission.contentSnapshot,
      excerpt: computeExcerpt(submission.contentSnapshot),
      tags: submission.tagsSnapshot,
      contentHash,
      status: "CHAIN_PENDING",
      isPlatformVisible: true,
    },
  });

  const outboxEvent = await tx.outboxEvent.create({
    data: {
      eventType: "PUBLISH_TO_CHAIN",
      aggregateType: "Publication",
      aggregateId: publication.id,
      payload: { publicationId: publication.id },
    },
  });

  await tx.workerJob.create({
    data: {
      outboxEventId: outboxEvent.id,
      kind: "PUBLISH_TO_CHAIN",
      publicationId: publication.id,
    },
  });

  await tx.publicationChainRecord.create({
    data: {
      publicationId: publication.id,
      network: env.SOLANA_CLUSTER,
      programId: env.SOLANA_PROGRAM_ID,
      chainStatus: "QUEUED",
    },
  });

  return publication;
}
