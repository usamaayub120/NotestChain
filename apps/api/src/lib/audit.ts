import type { Prisma } from "@prisma/client";
import { prisma } from "./prisma.js";

export interface AuditEntry {
  actorUserId?: string | null;
  action: string;
  targetType?: string;
  targetId?: string;
  metadata?: Record<string, unknown>;
  ipAddress?: string;
}

/** Never pass raw secrets/passwords/keys in metadata — this is written as-is. */
export async function recordAudit(entry: AuditEntry): Promise<void> {
  await prisma.auditLog.create({
    data: {
      actorUserId: entry.actorUserId ?? null,
      action: entry.action,
      targetType: entry.targetType,
      targetId: entry.targetId,
      metadata: entry.metadata as Prisma.InputJsonValue | undefined,
      ipAddress: entry.ipAddress,
    },
  });
}
