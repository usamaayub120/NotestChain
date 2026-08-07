import { z } from "zod";
import { LIMITS } from "@noteschain/shared";

export const createCommentSchema = z.object({
  body: z.string().trim().min(1).max(LIMITS.BODY_MAX_BYTES),
  parentCommentId: z.string().uuid().optional(),
  isAnonymous: z.boolean().default(false),
  displayName: z.string().trim().min(1).max(LIMITS.DISPLAY_NAME_MAX_LENGTH).optional(),
  captchaToken: z.string().min(1),
});
export type CreateCommentInput = z.infer<typeof createCommentSchema>;

export const updateCommentsEnabledSchema = z.object({
  commentsEnabled: z.boolean(),
});
export type UpdateCommentsEnabledInput = z.infer<typeof updateCommentsEnabledSchema>;

export const resolveCommentReportSchema = z.object({
  resolutionNote: z.string().trim().max(LIMITS.MODERATION_NOTE_MAX_LENGTH).optional(),
  action: z.enum(["DISMISSED", "COMMENT_REMOVED", "USER_SUSPENDED"]),
});
export type ResolveCommentReportInput = z.infer<typeof resolveCommentReportSchema>;
