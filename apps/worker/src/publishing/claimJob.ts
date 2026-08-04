import type { WorkerJob } from "@prisma/client";
import { prisma } from "../lib/prisma.js";

/**
 * Atomically claims exactly one due job using `FOR UPDATE SKIP LOCKED` —
 * safe even if this ever runs with more than one worker process (see
 * ARCHITECTURE.md §3.6). Picks PENDING jobs, or FAILED jobs that haven't
 * exhausted their retry budget and are past their backoff window.
 */
export async function claimNextJob(): Promise<WorkerJob | null> {
  const rows = await prisma.$queryRaw<WorkerJob[]>`
    UPDATE "WorkerJob"
    SET status = 'PROCESSING', "updatedAt" = now()
    WHERE id = (
      SELECT id FROM "WorkerJob"
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

const BASE_BACKOFF_MS = 5_000;
const MAX_BACKOFF_MS = 10 * 60 * 1000;

export function computeBackoff(attempts: number): Date {
  const delay = Math.min(BASE_BACKOFF_MS * 2 ** attempts, MAX_BACKOFF_MS);
  return new Date(Date.now() + delay);
}

export async function markJobSucceeded(jobId: string): Promise<void> {
  await prisma.$transaction(async (tx) => {
    const job = await tx.workerJob.update({ where: { id: jobId }, data: { status: "PROCESSED" } });
    await tx.outboxEvent.update({
      where: { id: job.outboxEventId },
      data: { status: "PROCESSED", processedAt: new Date() },
    });
  });
}

export async function markJobFailed(jobId: string, error: string): Promise<void> {
  const job = await prisma.workerJob.findUniqueOrThrow({ where: { id: jobId } });
  const attempts = job.attempts + 1;
  await prisma.workerJob.update({
    where: { id: jobId },
    data: {
      status: "FAILED",
      attempts,
      lastError: error.slice(0, 2000),
      nextAttemptAt: computeBackoff(attempts),
    },
  });
  await prisma.outboxEvent.update({
    where: { id: job.outboxEventId },
    data: { status: "FAILED", attempts, lastError: error.slice(0, 2000) },
  });
}
