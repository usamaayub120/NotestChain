import { z } from "zod";
import { LIMITS } from "@noteschain/shared";

export const moderationDecisionSchema = z.object({
  reason: z.string().trim().min(1).max(LIMITS.MODERATION_NOTE_MAX_LENGTH),
  note: z.string().trim().max(LIMITS.MODERATION_NOTE_MAX_LENGTH).optional(),
  flaggedPii: z.boolean().optional().default(false),
  flaggedAbuse: z.boolean().optional().default(false),
});
export type ModerationDecisionInput = z.infer<typeof moderationDecisionSchema>;
