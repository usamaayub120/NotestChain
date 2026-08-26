import type { z } from "zod";
import { PushKind } from "./kinds.js";
import type { RenderedPush } from "./render.js";
import {
  commentReceivedDataSchema,
  newFollowerDataSchema,
  publicationApprovedDataSchema,
  publicationChainFinalizedDataSchema,
  publicationChangesRequestedDataSchema,
  publicationRejectedDataSchema,
} from "./schemas.js";
import { renderCommentReceived } from "./templates/commentReceived.js";
import { renderNewFollower } from "./templates/newFollower.js";
import { renderPublicationApproved } from "./templates/publicationApproved.js";
import { renderPublicationChainFinalized } from "./templates/publicationChainFinalized.js";
import { renderPublicationChangesRequested } from "./templates/publicationChangesRequested.js";
import { renderPublicationRejected } from "./templates/publicationRejected.js";

interface PushTemplate<T> {
  schema: z.ZodType<T>;
  render: (data: T) => RenderedPush;
}

function defineTemplate<T>(schema: z.ZodType<T>, render: (data: T) => RenderedPush): PushTemplate<T> {
  return { schema, render };
}

/**
 * Same shape as @noteschain/email's EMAIL_TEMPLATES — the single source of
 * truth pairing each PushKind with the schema its payload must satisfy and
 * the function that turns that payload into a title/body/deepLink. Every
 * caller in apps/api and apps/worker goes through this map.
 */
export const PUSH_TEMPLATES = {
  [PushKind.COMMENT_RECEIVED]: defineTemplate(commentReceivedDataSchema, renderCommentReceived),
  [PushKind.PUBLICATION_APPROVED]: defineTemplate(publicationApprovedDataSchema, renderPublicationApproved),
  [PushKind.PUBLICATION_REJECTED]: defineTemplate(publicationRejectedDataSchema, renderPublicationRejected),
  [PushKind.PUBLICATION_CHANGES_REQUESTED]: defineTemplate(
    publicationChangesRequestedDataSchema,
    renderPublicationChangesRequested,
  ),
  [PushKind.PUBLICATION_CHAIN_FINALIZED]: defineTemplate(
    publicationChainFinalizedDataSchema,
    renderPublicationChainFinalized,
  ),
  [PushKind.NEW_FOLLOWER]: defineTemplate(newFollowerDataSchema, renderNewFollower),
  // `PushTemplate<any>` here is only a variance escape hatch for `satisfies`
  // checking a map of genuinely different payload shapes against one key —
  // see @noteschain/email's registry.ts for the same pattern and reasoning.
} satisfies Record<PushKind, PushTemplate<any>>;

/** Extracts the exact payload type a given kind's schema produces. */
export type PushDataFor<K extends PushKind> = (typeof PUSH_TEMPLATES)[K] extends PushTemplate<infer T> ? T : never;

/**
 * Validates `data` against `kind`'s schema and returns it as a plain object
 * ready to store in PushJob.data. Call this at enqueue time so a malformed
 * payload fails loudly right where the bug is.
 */
export function buildPushJobData<K extends PushKind>(kind: K, data: PushDataFor<K>): Record<string, unknown> {
  const template = PUSH_TEMPLATES[kind] as unknown as PushTemplate<PushDataFor<K>>;
  return template.schema.parse(data) as Record<string, unknown>;
}

/**
 * Validates `data` again and renders it. Called at send time (the worker),
 * not at enqueue time, so a copy fix applies even to jobs already sitting
 * in the queue when it ships.
 */
export function renderPush(kind: PushKind, data: unknown): RenderedPush {
  const template = PUSH_TEMPLATES[kind] as unknown as PushTemplate<unknown>;
  const parsed = template.schema.parse(data);
  return template.render(parsed);
}
