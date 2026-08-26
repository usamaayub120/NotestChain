import { z } from "zod";
import { LIMITS } from "@noteschain/shared";

/**
 * `publicIdentityId` is the current shape: a comment is posted under a
 * byline, the same as a note. `isAnonymous` + `displayName` is the shape an
 * already-installed mobile binary still sends; the service maps
 * `isAnonymous: false` onto the commenter's Keeper profile and continues to
 * honor `isAnonymous: true` until ALLOW_ANONYMOUS_POSTING is turned off (see
 * apps/api/src/config/env.ts). Both are accepted at once so an old client
 * never breaks; new clients should always send `publicIdentityId`.
 */
export const createCommentSchema = z.object({
  // COMMENT_MAX_BYTES, not the note body limit. These used to be the same
  // constant, which meant raising the note limit would have silently uncapped
  // comments too. Comments are a different thing with different abuse
  // characteristics — they get their own number on purpose.
  body: z.string().trim().min(1).max(LIMITS.COMMENT_MAX_BYTES),
  parentCommentId: z.string().uuid().optional(),
  publicIdentityId: z.string().uuid().optional(),
  isAnonymous: z.boolean().optional(),
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
