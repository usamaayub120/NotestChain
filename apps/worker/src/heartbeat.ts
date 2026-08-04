import type { Prisma } from "@prisma/client";
import { prisma } from "./lib/prisma.js";

export async function beatHeartbeat(meta?: Record<string, unknown>): Promise<void> {
  const metaJson = meta as Prisma.InputJsonValue | undefined;
  await prisma.processHeartbeat.upsert({
    where: { process: "worker" },
    create: { process: "worker", lastBeatAt: new Date(), meta: metaJson },
    update: { lastBeatAt: new Date(), meta: metaJson },
  });
}
