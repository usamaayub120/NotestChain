import { prisma } from "../lib/prisma.js";
import { logger } from "../lib/logger.js";
import { claimNextJob, markJobFailed, markJobSucceeded } from "./claimJob.js";
import { PermanentPublishError, publishPublicationToChain } from "./publishToChain.js";

/** Claims and processes at most one due job per call — the worker's main
 * loop calls this on every tick, so throughput is bounded by the tick
 * interval rather than by looping unboundedly here. */
export async function claimAndProcessOutbox(): Promise<void> {
  const job = await claimNextJob();
  if (!job) return;

  const log = logger.child({ jobId: job.id, publicationId: job.publicationId });
  log.info("Claimed outbox job");

  try {
    await publishPublicationToChain(job.publicationId, job.id);
    await markJobSucceeded(job.id);
    log.info("Job succeeded");
  } catch (err) {
    const isPermanent = err instanceof PermanentPublishError;
    const message = err instanceof Error ? err.message : String(err);
    log.error({ err: message, permanent: isPermanent }, "Job failed");

    await markJobFailed(job.id, message);

    if (isPermanent) {
      // Don't wait out the normal backoff schedule for something that will
      // never succeed on retry — jump straight to exhausted.
      await prisma.workerJob.update({
        where: { id: job.id },
        data: { attempts: job.maxAttempts },
      });
      await prisma.publicationChainRecord.update({
        where: { publicationId: job.publicationId },
        data: { chainStatus: "FAILED_PERMANENT", lastError: message },
      });
    } else {
      const updated = await prisma.workerJob.findUniqueOrThrow({ where: { id: job.id } });
      await prisma.publicationChainRecord.update({
        where: { publicationId: job.publicationId },
        data: {
          chainStatus: updated.attempts >= updated.maxAttempts ? "FAILED_PERMANENT" : "FAILED_RETRYABLE",
          lastError: message,
        },
      });
    }
  }
}
