import type { PushJob } from "@prisma/client";
import { prisma } from "../lib/prisma.js";
import { computeBackoff } from "../publishing/claimJob.js";

/**
 * Same claim/backoff shape as apps/worker/src/email/claimEmailJob.ts,
 * operating on PushJob instead — see PushJob's doc comment in
 * schema.prisma for why this is a parallel table rather than a reuse of
 * EmailJob or WorkerJob. `computeBackoff` is imported rather than
 * duplicated: the backoff math has nothing chain- or channel-specific
 * about it.
 */
export async function claimNextPushJob(): Promise<PushJob | null> {
  const rows = await prisma.$queryRaw<PushJob[]>`
    UPDATE "PushJob"
    SET status = 'PROCESSING', "updatedAt" = now()
    WHERE id = (
      SELECT id FROM "PushJob"
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

export async function markPushJobSucceeded(jobId: string): Promise<void> {
  await prisma.pushJob.update({
    where: { id: jobId },
    data: { status: "SENT", sentAt: new Date() },
  });
}

/** Returns the updated row so the caller can tell whether the retry budget is now exhausted. */
export async function markPushJobFailed(jobId: string, error: string): Promise<PushJob> {
  const job = await prisma.pushJob.findUniqueOrThrow({ where: { id: jobId } });
  const attempts = job.attempts + 1;
  return prisma.pushJob.update({
    where: { id: jobId },
    data: {
      status: "FAILED",
      attempts,
      lastError: error.slice(0, 2000),
      nextAttemptAt: computeBackoff(attempts),
    },
  });
}
