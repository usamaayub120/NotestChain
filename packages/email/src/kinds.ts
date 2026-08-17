/**
 * The complete set of transactional emails NotesChain sends.
 *
 * A new kind means: add a value here, a schema in schemas.ts, a template in
 * templates/, and one line in registry.ts. Nothing else needs to change —
 * the EmailJob table, the worker's claim/retry loop, and the mailer are all
 * generic over EmailKind.
 *
 * Defined as a plain object rather than imported from @prisma/client's
 * generated enum, matching how packages/shared hand-mirrors Prisma enums
 * (DraftStatus, ModerationAction, ...) — this package stays Prisma-free and
 * independently testable, and the frontend never needs it at all. The
 * values here must stay byte-identical to the `EmailKind` enum in
 * prisma/schema.prisma; nothing enforces that automatically, so keep them
 * in the same PR.
 */
export const EmailKind = {
  PUBLICATION_APPROVED: "PUBLICATION_APPROVED",
  PUBLICATION_REJECTED: "PUBLICATION_REJECTED",
  PUBLICATION_CHANGES_REQUESTED: "PUBLICATION_CHANGES_REQUESTED",
  PUBLICATION_CHAIN_FINALIZED: "PUBLICATION_CHAIN_FINALIZED",
  PASSWORD_RESET_REQUESTED: "PASSWORD_RESET_REQUESTED",
  ACCOUNT_WELCOME: "ACCOUNT_WELCOME",
  COMMENT_RECEIVED: "COMMENT_RECEIVED",
} as const;

export type EmailKind = (typeof EmailKind)[keyof typeof EmailKind];
