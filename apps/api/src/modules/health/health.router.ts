import { Router } from "express";
import { prisma } from "../../lib/prisma.js";
import { env } from "../../config/env.js";
import { asyncHandler } from "../../lib/http.js";

export const healthRouter = Router();

const WORKER_STALE_AFTER_MS = 60_000;

healthRouter.get("/health", (_req, res) => {
  res.status(200).json({ status: "ok" });
});

healthRouter.get(
  "/health/ready",
  asyncHandler(async (_req, res) => {
    const checks: Record<string, { ok: boolean; detail?: string }> = {};

    try {
      await prisma.$queryRaw`SELECT 1`;
      checks.database = { ok: true };
    } catch {
      checks.database = { ok: false, detail: "unreachable" };
    }

    try {
      const heartbeat = await prisma.processHeartbeat.findUnique({ where: { process: "worker" } });
      const ageMs = heartbeat ? Date.now() - heartbeat.lastBeatAt.getTime() : Number.POSITIVE_INFINITY;
      checks.worker = { ok: ageMs < WORKER_STALE_AFTER_MS, detail: heartbeat ? `${Math.round(ageMs / 1000)}s ago` : "no heartbeat yet" };
    } catch {
      checks.worker = { ok: false, detail: "unable to read heartbeat" };
    }

    let rpcOk: boolean;
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 2000);
      const resp = await fetch(env.SOLANA_RPC_HTTP_URL, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "getHealth" }),
        signal: controller.signal,
      });
      clearTimeout(timeout);
      rpcOk = resp.ok;
    } catch {
      rpcOk = false;
    }
    checks.solanaRpc = { ok: rpcOk, detail: rpcOk ? undefined : "unreachable or slow" };

    const allOk = Object.values(checks).every((c) => c.ok);
    res.status(allOk ? 200 : 503).json({
      status: allOk ? "ready" : "degraded",
      version: env.APP_VERSION,
      programId: env.SOLANA_PROGRAM_ID,
      cluster: env.SOLANA_CLUSTER,
      checks,
    });
  }),
);
