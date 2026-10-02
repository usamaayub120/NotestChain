import type { Draft } from "@/src/lib/models";

/**
 * Mirrors packages/shared/src/labels.ts, which is the source of truth.
 *
 * Kept as a parallel file because the mobile workspace deliberately has no
 * dependency on @noteschain/* -  the same arrangement as limits.ts,
 * kept-state.ts and `appName` in config.ts. Anything changed there must be
 * changed here; that is the cost of the arrangement, and it is still far
 * cheaper than what it replaces.
 *
 * What it replaces: four different strings for the single state "this note
 * is on its way to the chain" -  "Publishing…" on the web card, "Publishing"
 * on the mobile card, "Pending publication" on the mobile reader, and
 * "Publishing in progress" in the web badge's label. Plus three variants of
 * the byline kind, where §11 and §12 both say "Keeper profile" and four of
 * the six sites said "Primary profile".
 */
export const DRAFT_STATUS_LABELS: Record<Draft["status"], string> = {
  DRAFT: "Draft",
  PENDING_REVIEW: "Awaiting review",
  CHANGES_REQUESTED: "Changes requested",
  REJECTED: "Rejected",
  APPROVED: "Ready to publish",
  CHAIN_PENDING: "Publishing…",
  CHAIN_SUBMITTED: "Publishing…",
  PUBLISHED: "Published",
  CHAIN_FAILED: "Publishing failed",
  ARCHIVED: "Archived",
};

export const IDENTITY_KIND_LABEL = { keeper: "Keeper profile", pen: "Pen name" } as const;

export function identityKindLabel(isPrimary: boolean): string {
  return isPrimary ? IDENTITY_KIND_LABEL.keeper : IDENTITY_KIND_LABEL.pen;
}

/** The format DESIGN_SYSTEM.md §11's card mock uses. */
export function formatRelativeTime(iso: string, now: number = Date.now()): string {
  const diffMs = now - new Date(iso).getTime();
  const minutes = Math.floor(diffMs / 60_000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return formatNoteDate(iso);
}

export function formatNoteDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

export function formatJoinedDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { month: "short", year: "numeric" });
}
