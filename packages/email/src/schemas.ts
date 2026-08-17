import { z } from "zod";

/**
 * zod's `.url()` accepts any syntactically valid URL, `javascript:alert(1)`
 * included — the WHATWG URL constructor it delegates to doesn't care about
 * scheme. Every link in these templates renders as a real `<a href>` in an
 * email a person clicks, so the schema itself should be the thing that
 * makes a non-http(s) link impossible, rather than trusting every call site
 * to only ever pass a URL it built itself.
 */
const httpUrl = z.string().url().refine((value) => /^https?:\/\//i.test(value), {
  message: "must be an http(s) URL",
});

export const publicationApprovedDataSchema = z.object({
  publicationTitle: z.string().min(1),
  draftEditUrl: httpUrl,
});
export type PublicationApprovedData = z.infer<typeof publicationApprovedDataSchema>;

export const publicationRejectedDataSchema = z.object({
  publicationTitle: z.string().min(1),
  reason: z.string().min(1),
  newDraftUrl: httpUrl,
});
export type PublicationRejectedData = z.infer<typeof publicationRejectedDataSchema>;

export const publicationChangesRequestedDataSchema = z.object({
  publicationTitle: z.string().min(1),
  reason: z.string().min(1),
  draftEditUrl: httpUrl,
});
export type PublicationChangesRequestedData = z.infer<typeof publicationChangesRequestedDataSchema>;

export const publicationChainFinalizedDataSchema = z.object({
  publicationTitle: z.string().min(1),
  publicationUrl: httpUrl,
  publicationPda: z.string().min(1),
  // Nullable, not optional: the worker always knows whether an explorer URL
  // exists for this transaction, so it should always pass one or the other
  // explicitly rather than omitting the key.
  explorerUrl: httpUrl.nullable(),
});
export type PublicationChainFinalizedData = z.infer<typeof publicationChainFinalizedDataSchema>;

export const passwordResetRequestedDataSchema = z.object({
  resetUrl: httpUrl,
  expiryMinutes: z.number().int().positive(),
});
export type PasswordResetRequestedData = z.infer<typeof passwordResetRequestedDataSchema>;

export const accountWelcomeDataSchema = z.object({
  startWritingUrl: httpUrl,
});
export type AccountWelcomeData = z.infer<typeof accountWelcomeDataSchema>;

export const commentReceivedDataSchema = z.object({
  publicationTitle: z.string().min(1),
  publicationUrl: httpUrl,
  // Already resolved to "Anonymous"/"Someone" or a real display name by the
  // caller — this package has no opinion on identity, it just prints a name.
  commenterName: z.string().min(1),
  commentBody: z.string().min(1),
});
export type CommentReceivedData = z.infer<typeof commentReceivedDataSchema>;
