import type { Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma.js";
import { logger } from "../lib/logger.js";
import { fetchAllPublicationAccounts } from "@noteschain/blockchain-client";
import { getSolanaClient } from "../publishing/solanaClient.js";

/**
 * Periodic getProgramAccounts sweep vs. the DB — see IMPLEMENTATION_PLAN.md
 * Phase 5 item 3. Deliberately only flags orphans/mismatches as audit-log
 * entries; it never "fixes" anything automatically (a human decides what a
 * mismatch means — e.g. a compromised publisher key vs. a stale cache).
 */
export async function runReconciliation(): Promise<void> {
  const { program } = getSolanaClient();

  // Both schemas, merged. Sweeping with program.account.publication.all()
  // alone would match only the v1 discriminator and report every v2
  // publication as missing from the chain.
  const onChainById = await fetchAllPublicationAccounts(program);

  const dbPublished = await prisma.publication.findMany({
    where: { status: "PUBLISHED", onChainPublicationId: { not: null } },
    select: { id: true, contentHash: true, onChainPublicationId: true, chainSchemaVersion: true },
  });

  const seenIds = new Set<string>();
  let mismatches = 0;

  for (const pub of dbPublished) {
    const key = pub.onChainPublicationId!.toString();
    seenIds.add(key);
    const match = onChainById.get(key);

    if (!match) {
      await flagIssue("RECONCILIATION_MISSING_ON_CHAIN", pub.id, { onChainPublicationId: key });
      mismatches++;
      continue;
    }

    if (match.account.schemaVersion !== pub.chainSchemaVersion) {
      await flagIssue("RECONCILIATION_VERSION_MISMATCH", pub.id, {
        onChainPublicationId: key,
        onChainSchemaVersion: match.account.schemaVersion,
        dbSchemaVersion: pub.chainSchemaVersion,
      });
      mismatches++;
      continue;
    }

    const onChainHash = match.account.contentHash;
    if (onChainHash !== pub.contentHash) {
      await flagIssue("RECONCILIATION_HASH_MISMATCH", pub.id, {
        onChainPublicationId: key,
        onChainHash,
        dbContentHash: pub.contentHash,
      });
      mismatches++;
      continue;
    }

    await prisma.publicationChainRecord.update({
      where: { publicationId: pub.id },
      data: { lastVerifiedAt: new Date() },
    });
  }

  for (const [key, entry] of onChainById) {
    if (!seenIds.has(key)) {
      await flagIssue("RECONCILIATION_ORPHAN_ON_CHAIN", null, {
        onChainPublicationId: key,
        publicationPda: entry.address.toBase58(),
        schemaVersion: entry.account.schemaVersion,
      });
      mismatches++;
    }
  }

  logger.info(
    { onChainCount: onChainById.size, dbPublishedCount: dbPublished.length, mismatches },
    "Reconciliation sweep complete",
  );
}

async function flagIssue(action: string, publicationId: string | null, metadata: Record<string, unknown>): Promise<void> {
  await prisma.auditLog.create({
    data: { action, targetType: "Publication", targetId: publicationId, metadata: metadata as Prisma.InputJsonValue },
  });
  logger.warn({ action, publicationId, metadata }, "Reconciliation issue flagged");
}
