import type { EmailJob } from "@prisma/client";
import { prisma } from "../lib/prisma.js";
import { computeBackoff } from "../publishing/claimJob.js";

/**
 * Same claim/backoff shape as apps/worker/src/publishing/claimJob.ts,
 * operating on EmailJob instead of WorkerJob — see EmailJob's doc comment
 * in schema.prisma for why this is a parallel table rather than a reuse of
 * that one. `computeBackoff` is imported rather than duplicated: the backoff
 * math itself has nothing chain-specific about it.
 */
export async function claimNextEmailJob(): Promise<EmailJob | null> {
  const rows = await prisma.$queryRaw<EmailJob[]>`
    UPDATE "EmailJob"
    SET status = 'PROCESSING', "updatedAt" = now()
    WHERE id = (
      SELECT id FROM "EmailJob"
      WHERE (status = 'PENDING' OR (status = 'FAILED' AND attempts < "maxAttempts"))
        AND "nextAttemptAt" <= now()
      ORDER BY "nextAttemptAt" ASC
      FOR UPDATE SKIP LOCKED
      LIMIT 1
    )
    RETURNING *
  `;
  return rows[0] ?? null;
}

export async function markEmailJobSucceeded(jobId: string): Promise<void> {
  await prisma.emailJob.update({
    where: { id: jobId },
    data: { status: "SENT", sentAt: new Date() },
  });
}

/** Returns the updated row so the caller can tell whether the retry budget is now exhausted. */
export async function markEmailJobFailed(jobId: string, error: string): Promise<EmailJob> {
  const job = await prisma.emailJob.findUniqueOrThrow({ where: { id: jobId } });
  const attempts = job.attempts + 1;
  return prisma.emailJob.update({
    where: { id: jobId },
    data: {
      status: "FAILED",
      attempts,
      lastError: error.slice(0, 2000),
      nextAttemptAt: computeBackoff(attempts),
    },
  });
}
