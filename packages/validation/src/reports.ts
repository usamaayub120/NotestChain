import { z } from "zod";
import { LIMITS } from "@noteschain/shared";

export const createReportSchema = z.object({
  reason: z.string().trim().min(1).max(LIMITS.REPORT_REASON_MAX_LENGTH),
});
export type CreateReportInput = z.infer<typeof createReportSchema>;

export const resolveReportSchema = z.object({
  resolutionNote: z.string().trim().max(LIMITS.MODERATION_NOTE_MAX_LENGTH).optional(),
  action: z.enum(["DISMISSED", "DELISTED", "USER_SUSPENDED"]),
});
export type ResolveReportInput = z.infer<typeof resolveReportSchema>;
