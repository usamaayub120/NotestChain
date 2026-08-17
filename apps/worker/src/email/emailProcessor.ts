import { renderEmail } from "@noteschain/email";
import { prisma } from "../lib/prisma.js";
import { logger } from "../lib/logger.js";
import { claimNextEmailJob, markEmailJobFailed, markEmailJobSucceeded } from "./claimEmailJob.js";
import { sendMail } from "./mailer.js";

/**
 * Claims and processes at most one due EmailJob per call, same throughput
 * shape as claimAndProcessOutbox — bounded by the tick interval rather than
 * looping unboundedly here (see that function's doc comment).
 *
 * Rendering happens here, at send time, not when the job was enqueued —
 * `renderEmail` re-validates `job.data` against the kind's schema and then
 * renders, so a template fix ships to jobs that were already queued when it
 * landed.
 */
export async function claimAndProcessEmailJobs(): Promise<void> {
  const job = await claimNextEmailJob();
  if (!job) return;

  const log = logger.child({ emailJobId: job.id, kind: job.kind, toEmail: job.toEmail });
  log.info("Claimed email job");

  try {
    const rendered = renderEmail(job.kind, job.data);
    await sendMail({ to: job.toEmail, subject: rendered.subject, html: rendered.html, text: rendered.text });
    await markEmailJobSucceeded(job.id);
    log.info("Email sent");
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    log.error({ err: message }, "Email job failed");
    const updated = await markEmailJobFailed(job.id, message);

    if (updated.attempts >= updated.maxAttempts) {
      // A human needs to notice this — nothing else will. Unlike
      // publish-to-chain failures, which surface visibly on
      // /admin/blockchain, there's no dedicated UI for stuck emails, so the
      // audit log is the whole safety net.
      await prisma.auditLog.create({
        data: {
          action: "EMAIL_SEND_EXHAUSTED",
          targetType: "EmailJob",
          targetId: job.id,
          metadata: { kind: job.kind, toEmail: job.toEmail, attempts: updated.attempts, lastError: message },
        },
      });
      log.error("Email job exhausted its retry budget — flagged in the audit log");
    }
  }
}
