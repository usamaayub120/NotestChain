import { env } from "./config/env.js";
import { logger } from "./lib/logger.js";
import { prisma } from "./lib/prisma.js";
import { beatHeartbeat } from "./heartbeat.js";
import { claimAndProcessOutbox } from "./publishing/outboxProcessor.js";
import { runReconciliation } from "./reconciliation/reconcile.js";

logger.info({ cluster: env.SOLANA_CLUSTER, programId: env.SOLANA_PROGRAM_ID }, "NotesChain worker starting");

let stopping = false;
let lastReconciledAt = 0;

async function tick(): Promise<void> {
  await beatHeartbeat({ cluster: env.SOLANA_CLUSTER });
  await claimAndProcessOutbox();

  if (Date.now() - lastReconciledAt >= env.WORKER_RECONCILE_INTERVAL_MS) {
    lastReconciledAt = Date.now();
    try {
      await runReconciliation();
    } catch (err) {
      logger.error({ err }, "Reconciliation sweep failed");
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
