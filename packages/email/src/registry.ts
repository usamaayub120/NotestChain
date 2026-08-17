import type { z } from "zod";
import { EmailKind } from "./kinds.js";
import type { RenderedEmail } from "./layout.js";
import {
  accountWelcomeDataSchema,
  commentReceivedDataSchema,
  passwordResetRequestedDataSchema,
  publicationApprovedDataSchema,
  publicationChainFinalizedDataSchema,
  publicationChangesRequestedDataSchema,
  publicationRejectedDataSchema,
} from "./schemas.js";
import { renderAccountWelcome } from "./templates/accountWelcome.js";
import { renderCommentReceived } from "./templates/commentReceived.js";
import { renderPasswordResetRequested } from "./templates/passwordResetRequested.js";
import { renderPublicationApproved } from "./templates/publicationApproved.js";
import { renderPublicationChainFinalized } from "./templates/publicationChainFinalized.js";
import { renderPublicationChangesRequested } from "./templates/publicationChangesRequested.js";
import { renderPublicationRejected } from "./templates/publicationRejected.js";

interface EmailTemplate<T> {
  schema: z.ZodType<T>;
  render: (data: T) => RenderedEmail;
}

function defineTemplate<T>(schema: z.ZodType<T>, render: (data: T) => RenderedEmail): EmailTemplate<T> {
  return { schema, render };
}

/**
 * The single source of truth pairing each EmailKind with the schema its
 * payload must satisfy and the function that turns that payload into a
 * sendable email. Everything else in this package — and every caller in
 * apps/api and apps/worker — goes through this map rather than importing a
 * template file directly, so adding a kind means adding one line here.
 */
export const EMAIL_TEMPLATES = {
  [EmailKind.PUBLICATION_APPROVED]: defineTemplate(publicationApprovedDataSchema, renderPublicationApproved),
  [EmailKind.PUBLICATION_REJECTED]: defineTemplate(publicationRejectedDataSchema, renderPublicationRejected),
  [EmailKind.PUBLICATION_CHANGES_REQUESTED]: defineTemplate(
    publicationChangesRequestedDataSchema,
    renderPublicationChangesRequested,
  ),
  [EmailKind.PUBLICATION_CHAIN_FINALIZED]: defineTemplate(
    publicationChainFinalizedDataSchema,
    renderPublicationChainFinalized,
  ),
  [EmailKind.PASSWORD_RESET_REQUESTED]: defineTemplate(passwordResetRequestedDataSchema, renderPasswordResetRequested),
  [EmailKind.ACCOUNT_WELCOME]: defineTemplate(accountWelcomeDataSchema, renderAccountWelcome),
  [EmailKind.COMMENT_RECEIVED]: defineTemplate(commentReceivedDataSchema, renderCommentReceived),
  // `EmailTemplate<any>` here is only a variance escape hatch for `satisfies`
  // checking a map of genuinely different payload shapes against one key —
  // it doesn't leak into callers, who always go through EmailDataFor<K> for
  // real per-key type safety.
} satisfies Record<EmailKind, EmailTemplate<any>>;

/** Extracts the exact payload type a given kind's schema produces. */
export type EmailDataFor<K extends EmailKind> = (typeof EMAIL_TEMPLATES)[K] extends EmailTemplate<infer T> ? T : never;

/**
 * Validates `data` against `kind`'s schema and returns it as a plain object
 * ready to store in EmailJob.data. Call this at enqueue time (API side) so a
 * malformed payload fails loudly right where the bug is, instead of sitting
 * in the queue until the worker tries to render it.
 */
export function buildEmailJobData<K extends EmailKind>(kind: K, data: EmailDataFor<K>): Record<string, unknown> {
  const template = EMAIL_TEMPLATES[kind] as unknown as EmailTemplate<EmailDataFor<K>>;
  return template.schema.parse(data) as Record<string, unknown>;
}

/**
 * Validates `data` again and renders it. Called at send time (worker side)
 * rather than at enqueue time, so a template fix applies even to jobs that
 * were already sitting in the queue when it shipped.
 */
export function renderEmail(kind: EmailKind, data: unknown): RenderedEmail {
  const template = EMAIL_TEMPLATES[kind] as unknown as EmailTemplate<unknown>;
  const parsed = template.schema.parse(data);
  return template.render(parsed);
}
