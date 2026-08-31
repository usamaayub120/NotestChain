// Mirrors the Prisma enums 1:1 — kept here too so the frontend and the
// blockchain-client package don't need to import @prisma/client.

export const Role = { USER: "USER", MODERATOR: "MODERATOR", ADMIN: "ADMIN" } as const;
export type Role = (typeof Role)[keyof typeof Role];

/**
 * Staff access is additive.  `Role` above remains as a compatibility field
 * while existing accounts are migrated; authorization must use StaffRole /
 * Permission rather than the old numeric role ladder.
 */
export const StaffRole = {
  MODERATOR: "MODERATOR",
  CAMPAIGN_CREATOR: "CAMPAIGN_CREATOR",
  CAMPAIGN_APPROVER: "CAMPAIGN_APPROVER",
  PLATFORM_ADMIN: "PLATFORM_ADMIN",
  ACCESS_MANAGER: "ACCESS_MANAGER",
  OWNER: "OWNER",
} as const;
export type StaffRole = (typeof StaffRole)[keyof typeof StaffRole];

export const Permission = {
  MODERATE_CONTENT: "MODERATE_CONTENT",
  MANAGE_PLATFORM: "MANAGE_PLATFORM",
  CREATE_CAMPAIGN: "CREATE_CAMPAIGN",
  APPROVE_CAMPAIGN: "APPROVE_CAMPAIGN",
  MANAGE_STAFF_ACCESS: "MANAGE_STAFF_ACCESS",
  MANAGE_ACCESS_MANAGERS: "MANAGE_ACCESS_MANAGERS",
} as const;
export type Permission = (typeof Permission)[keyof typeof Permission];

const ROLE_PERMISSIONS: Record<StaffRole, readonly Permission[]> = {
  [StaffRole.MODERATOR]: [Permission.MODERATE_CONTENT],
  [StaffRole.CAMPAIGN_CREATOR]: [Permission.CREATE_CAMPAIGN],
  [StaffRole.CAMPAIGN_APPROVER]: [Permission.APPROVE_CAMPAIGN],
  [StaffRole.PLATFORM_ADMIN]: [Permission.MANAGE_PLATFORM],
  [StaffRole.ACCESS_MANAGER]: [Permission.MANAGE_STAFF_ACCESS],
  [StaffRole.OWNER]: Object.values(Permission),
};

export function hasPermission(roles: readonly string[] | undefined, permission: Permission): boolean {
  return (roles ?? []).some((role) => (ROLE_PERMISSIONS as Record<string, readonly Permission[] | undefined>)[role]?.includes(permission));
}

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

/**
 * What a *new* byline picker should offer. ANONYMOUS is deliberately absent:
 * every Keeper has a profile now, so there is always a non-anonymous choice.
 * The enum value itself, IDENTITY_MODE_CODE's entry for it, and every code
 * path that renders an already-published anonymous note all stay forever —
 * see apps/worker/src/publishing/publishToChain.ts and AGENTS.md. This
 * constant governs what clients show, not what the API accepts; the server
 * keeps honoring ANONYMOUS on submit until ALLOW_ANONYMOUS_POSTING is turned
 * off (apps/api/src/config/env.ts), so an already-installed mobile binary
 * doesn't break the day this ships.
 */
export const SELECTABLE_IDENTITY_MODES = [IdentityMode.NAMED, IdentityMode.PSEUDONYMOUS] as const;

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
