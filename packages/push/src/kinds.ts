/**
 * The complete set of push notifications NotesChain sends.
 *
 * Deliberately a subset of @noteschain/email's EmailKind, not the same
 * enum: PASSWORD_RESET_REQUESTED stays email-only (security-sensitive,
 * must not depend on a channel a device could intercept or a notification
 * a bystander could glance at), WALLET_BALANCE_LOW stays email-only
 * (admin-only ops, no reader ever needs it on their phone), and
 * ACCOUNT_WELCOME has no push equivalent (nobody has registered a device
 * yet at the moment it fires). NEW_FOLLOWER has no email equivalent at
 * all — see ARCHITECTURE.md §4a for why it's safe to send: the follower
 * shown is always the recipient's own already-public Keeper profile,
 * never a pen name, so nothing about a follower's other identities is
 * ever revealed here.
 *
 * A new kind means: add a value here, a schema in schemas.ts, a template
 * in templates/, and one line in registry.ts — same shape as
 * @noteschain/email. Defined as a plain object rather than imported from
 * @prisma/client's generated enum, for the same reason: this package stays
 * Prisma-free and independently testable, and the values here must stay
 * byte-identical to the `PushKind` enum in prisma/schema.prisma.
 */
export const PushKind = {
  COMMENT_RECEIVED: "COMMENT_RECEIVED",
  PUBLICATION_APPROVED: "PUBLICATION_APPROVED",
  PUBLICATION_REJECTED: "PUBLICATION_REJECTED",
  PUBLICATION_CHANGES_REQUESTED: "PUBLICATION_CHANGES_REQUESTED",
  PUBLICATION_CHAIN_FINALIZED: "PUBLICATION_CHAIN_FINALIZED",
  NEW_FOLLOWER: "NEW_FOLLOWER",
} as const;

export type PushKind = (typeof PushKind)[keyof typeof PushKind];
