import type { Prisma, Submission } from "@prisma/client";
import { contentHashHex, contentHashV2Hex } from "@noteschain/blockchain-client";
import { computeExcerpt, markdownToPlainText, utf8ByteLength } from "@noteschain/shared";
import { Errors } from "../../lib/apiError.js";
import { env } from "../../config/env.js";

export { computeExcerpt };

/**
 * The on-chain schema new publications are written under.
 *
 * v1 kept the whole note body inside the Solana account, which is why the
 * body was capped at 600 bytes — title + author display + body all had to fit
 * inside Solana's hard 1232-byte transaction limit. v2 commits only the
 * digest, which is what makes long notes possible.
 */
const CHAIN_SCHEMA_VERSION = 2;

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

  const title = submission.titleSnapshot;
  const content = submission.contentSnapshot;
  const contentFormat = submission.contentFormatSnapshot;

  // The plain projection is what search indexes and what the excerpt is cut
  // from, so `**bold**` never reaches the index, a search snippet, or a card
  // preview. For a plaintext note it is the content unchanged.
  const contentPlain = contentFormat === "MARKDOWN" ? markdownToPlainText(content) : content;

  // Grapheme-safe and byte-capped. This value is about to become permanent:
  // under the v2 schema the excerpt is inside the hash preimage, so a
  // character sliced in half here would be hashed onto the chain forever.
  const excerpt = computeExcerpt(contentPlain);

  // v1 hashed title + body. v2 hashes title + excerpt + body under a domain
  // tag with length prefixes, because the body can now contain any bytes —
  // including the 0x1E that v1 used as a field separator.
  const contentHash =
    CHAIN_SCHEMA_VERSION === 2 ? contentHashV2Hex(title, excerpt, content) : contentHashHex(title, content);

  const publication = await tx.publication.create({
    data: {
      sourceDraftId: submission.draftId,
      privateAuthorUserId,
      publicIdentityId: submission.publicIdentityIdSnapshot,
      identityMode: submission.identityModeSnapshot,
      discoverability: submission.discoverabilitySnapshot,
      title,
      content,
      contentFormat,
      contentPlain,
      contentBytes: utf8ByteLength(content),
      excerpt,
      tags: submission.tagsSnapshot,
      contentHash,
      chainSchemaVersion: CHAIN_SCHEMA_VERSION,
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
