import { z } from "zod";

export const commentReceivedDataSchema = z.object({
  publicationId: z.string().min(1),
  publicationTitle: z.string().min(1),
  // Already resolved to a real display name by the caller — this package
  // has no opinion on identity, it just prints one. Matches
  // @noteschain/email's commentReceivedDataSchema.
  commenterName: z.string().min(1),
});
export type CommentReceivedData = z.infer<typeof commentReceivedDataSchema>;

export const publicationApprovedDataSchema = z.object({
  draftId: z.string().min(1),
  publicationTitle: z.string().min(1),
});
export type PublicationApprovedData = z.infer<typeof publicationApprovedDataSchema>;

export const publicationRejectedDataSchema = z.object({
  draftId: z.string().min(1),
  publicationTitle: z.string().min(1),
  reason: z.string().min(1),
});
export type PublicationRejectedData = z.infer<typeof publicationRejectedDataSchema>;

export const publicationChangesRequestedDataSchema = z.object({
  draftId: z.string().min(1),
  publicationTitle: z.string().min(1),
  reason: z.string().min(1),
});
export type PublicationChangesRequestedData = z.infer<typeof publicationChangesRequestedDataSchema>;

export const publicationChainFinalizedDataSchema = z.object({
  publicationId: z.string().min(1),
  publicationTitle: z.string().min(1),
});
export type PublicationChainFinalizedData = z.infer<typeof publicationChainFinalizedDataSchema>;

/**
 * The follower shown here is always the recipient's own Keeper profile —
 * Follow.followerUserId is never a pen name (see ARCHITECTURE.md §4a) — so
 * this is always the follower's already-public identity, never a
 * correlation leak between two of the follower's own bylines.
 */
export const newFollowerDataSchema = z.object({
  followerUsername: z.string().min(1),
  followerDisplayName: z.string().min(1),
  // Which of the RECIPIENT's own bylines gained the follower — a Keeper
  // with several pen names needs to know which one.
  targetUsername: z.string().min(1),
  targetDisplayName: z.string().min(1),
});
export type NewFollowerData = z.infer<typeof newFollowerDataSchema>;
