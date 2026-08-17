// Mirrors the Prisma enums 1:1 — kept here too so the frontend and the
// blockchain-client package don't need to import @prisma/client.

export const Role = { USER: "USER", MODERATOR: "MODERATOR", ADMIN: "ADMIN" } as const;
export type Role = (typeof Role)[keyof typeof Role];

export const AccountStatus = {
  ACTIVE: "ACTIVE",
  SUSPENDED: "SUSPENDED",
  DELETED: "DELETED",
} as const;
export type AccountStatus = (typeof AccountStatus)[keyof typeof AccountStatus];

export const IdentityType = { REAL_NAME: "REAL_NAME", PSEUDONYM: "PSEUDONYM" } as const;
export type IdentityType = (typeof IdentityType)[keyof typeof IdentityType];

export const IdentityMode = {
  NAMED: "NAMED",
  PSEUDONYMOUS: "PSEUDONYMOUS",
  ANONYMOUS: "ANONYMOUS",
} as const;
export type IdentityMode = (typeof IdentityMode)[keyof typeof IdentityMode];

export const Discoverability = { PUBLIC: "PUBLIC", UNLISTED: "UNLISTED" } as const;
export type Discoverability = (typeof Discoverability)[keyof typeof Discoverability];

export const DraftStatus = {
  DRAFT: "DRAFT",
  PENDING_REVIEW: "PENDING_REVIEW",
  CHANGES_REQUESTED: "CHANGES_REQUESTED",
  REJECTED: "REJECTED",
  APPROVED: "APPROVED",
  CHAIN_PENDING: "CHAIN_PENDING",
  CHAIN_SUBMITTED: "CHAIN_SUBMITTED",
  PUBLISHED: "PUBLISHED",
  CHAIN_FAILED: "CHAIN_FAILED",
  ARCHIVED: "ARCHIVED",
} as const;
export type DraftStatus = (typeof DraftStatus)[keyof typeof DraftStatus];

export const ModerationAction = {
  APPROVE: "APPROVE",
  REJECT: "REJECT",
  REQUEST_CHANGES: "REQUEST_CHANGES",
} as const;
export type ModerationAction = (typeof ModerationAction)[keyof typeof ModerationAction];

export const ChainStatus = {
  NOT_SUBMITTED: "NOT_SUBMITTED",
  QUEUED: "QUEUED",
  SUBMITTING: "SUBMITTING",
  SUBMITTED: "SUBMITTED",
  CONFIRMED: "CONFIRMED",
  FINALIZED: "FINALIZED",
  FAILED_RETRYABLE: "FAILED_RETRYABLE",
  FAILED_PERMANENT: "FAILED_PERMANENT",
} as const;
export type ChainStatus = (typeof ChainStatus)[keyof typeof ChainStatus];

export const OutboxStatus = {
  PENDING: "PENDING",
  PROCESSING: "PROCESSING",
  PROCESSED: "PROCESSED",
  FAILED: "FAILED",
} as const;
export type OutboxStatus = (typeof OutboxStatus)[keyof typeof OutboxStatus];

export const VerificationState = {
  VERIFIED: "VERIFIED",
  ACCOUNT_NOT_FOUND: "ACCOUNT_NOT_FOUND",
  HASH_MISMATCH: "HASH_MISMATCH",
  PDA_MISMATCH: "PDA_MISMATCH",
  UNSUPPORTED_VERSION: "UNSUPPORTED_VERSION",
  /// The account decoded fine but uses a different Publication schema than
  /// the database expects — an inconsistency in our records, not evidence
  /// that the note was altered. Distinct from HASH_MISMATCH on purpose.
  VERSION_MISMATCH: "VERSION_MISMATCH",
  RPC_UNAVAILABLE: "RPC_UNAVAILABLE",
  NOT_FINALIZED: "NOT_FINALIZED",
} as const;
export type VerificationState = (typeof VerificationState)[keyof typeof VerificationState];

// On-chain numeric encodings (program stores these as u8, not strings)
export const IDENTITY_MODE_CODE: Record<IdentityMode, number> = {
  NAMED: 0,
  PSEUDONYMOUS: 1,
  ANONYMOUS: 2,
};
export const DISCOVERABILITY_CODE: Record<Discoverability, number> = {
  PUBLIC: 0,
  UNLISTED: 1,
};
