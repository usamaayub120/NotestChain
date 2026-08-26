import { renderPush } from "@noteschain/push";
import { prisma } from "../lib/prisma.js";
import { logger } from "../lib/logger.js";
import { claimNextPushJob, markPushJobFailed, markPushJobSucceeded } from "./claimPushJob.js";
import { sendPushToUser } from "./pushSender.js";

/**
 * Claims and processes at most one due PushJob per call — same shape as
 * claimAndProcessEmailJobs. Rendering happens here, at send time, not when
 * the job was enqueued, so a copy fix ships to jobs already queued when it
 * lands.
 */
export async function claimAndProcessPushJobs(): Promise<void> {
  const job = await claimNextPushJob();
  if (!job) return;

  const log = logger.child({ pushJobId: job.id, kind: job.kind, userId: job.userId });
  log.info("Claimed push job");

  try {
    const rendered = renderPush(job.kind, job.data);
    const result = await sendPushToUser(job.userId, rendered);
    await markPushJobSucceeded(job.id);
    log.info({ delivered: result.delivered, pruned: result.pruned }, "Push job processed");
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    log.error({ err: message }, "Push job failed");
    const updated = await markPushJobFailed(job.id, message);

    if (updated.attempts >= updated.maxAttempts) {
      // Same safety net as EMAIL_SEND_EXHAUSTED — there's no dedicated UI
      // for stuck pushes either, so the audit log is what a human would
      // actually see.
      await prisma.auditLog.create({
        data: {
          action: "PUSH_SEND_EXHAUSTED",
          targetType: "PushJob",
          targetId: job.id,
          metadata: { kind: job.kind, userId: job.userId, attempts: updated.attempts, lastError: message },
        },
      });
      log.error("Push job exhausted its retry budget — flagged in the audit log");
    }
  }
}
