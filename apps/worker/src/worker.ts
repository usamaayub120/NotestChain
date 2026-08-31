import { isFirebaseConfigured } from "@noteschain/push";
import { env } from "./config/env.js";
import { logger } from "./lib/logger.js";
import { prisma } from "./lib/prisma.js";
import { beatHeartbeat } from "./heartbeat.js";
import { claimAndProcessEmailJobs } from "./email/emailProcessor.js";
import { claimAndProcessPushJobs } from "./push/pushProcessor.js";
import { claimAndProcessOutbox } from "./publishing/outboxProcessor.js";
import { runReconciliation } from "./reconciliation/reconcile.js";
import { checkWalletBalances } from "./monitoring/checkWalletBalances.js";
import { processCampaignDelivery } from "./campaigns/campaignProcessor.js";
import { pruneCampaignData } from "./campaigns/campaignRetention.js";

logger.info({ cluster: env.SOLANA_CLUSTER, programId: env.SOLANA_PROGRAM_ID }, "NotesChain worker starting");

// Push is an enhancement, not core to the product the way SMTP or the
// Solana publisher key are — a missing credential doesn't crash-loop the
// worker (which also handles chain publishing), it just means every
// PushJob retries with backoff and eventually lands in the audit log via
// PUSH_SEND_EXHAUSTED. This warning is the only place that says why.
if (!isFirebaseConfigured(env)) {
  logger.warn("FIREBASE_SERVICE_ACCOUNT_PATH/_JSON not set — push notifications are queued but never sent.");
}

let stopping = false;
let lastReconciledAt = 0;
let lastBalanceCheckAt = 0;
let lastCampaignRetentionAt = 0;

async function tick(): Promise<void> {
  await beatHeartbeat({ cluster: env.SOLANA_CLUSTER });
  await claimAndProcessOutbox();
  await claimAndProcessEmailJobs();
  await claimAndProcessPushJobs();
  await processCampaignDelivery();

  if (Date.now() - lastCampaignRetentionAt >= 86_400_000) {
    lastCampaignRetentionAt = Date.now();
    await pruneCampaignData();
  }

  if (Date.now() - lastReconciledAt >= env.WORKER_RECONCILE_INTERVAL_MS) {
    lastReconciledAt = Date.now();
    try {
      await runReconciliation();
    } catch (err) {
      logger.error({ err }, "Reconciliation sweep failed");
    }
  }

  if (Date.now() - lastBalanceCheckAt >= env.WORKER_BALANCE_CHECK_INTERVAL_MS) {
    lastBalanceCheckAt = Date.now();
    try {
      await checkWalletBalances();
    } catch (err) {
      logger.error({ err }, "Wallet balance check failed");
    }
  }
}

async function mainLoop(): Promise<void> {
  while (!stopping) {
    try {
      await tick();
    } catch (err) {
      logger.error({ err }, "Worker tick failed");
    }
    await new Promise((resolve) => setTimeout(resolve, env.WORKER_POLL_INTERVAL_MS));
  }
}

const loopPromise = mainLoop();

async function shutdown(signal: string) {
  logger.info({ signal }, "Worker shutting down gracefully");
  stopping = true;
  await loopPromise;
  await prisma.$disconnect();
  process.exit(0);
}

process.on("SIGTERM", () => void shutdown("SIGTERM"));
process.on("SIGINT", () => void shutdown("SIGINT"));
process.on("unhandledRejection", (reason) => {
  logger.error({ reason }, "Unhandled promise rejection in worker");
});
