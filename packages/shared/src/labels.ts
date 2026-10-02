import { DraftStatus } from "./enums.js";

/**
 * User-facing vocabulary that more than one surface has to say the same way.
 *
 * Before this file, the state "this note is on its way to the chain" shipped
 * as four different strings at once: "Publishing…" on the web card,
 * "Publishing" on the mobile card, "Pending publication" on the mobile
 * reader, and "Publishing in progress" in the web badge's aria-label. The
 * two status maps in DraftsListPage.tsx and app/drafts.tsx were near-copies
 * that had already drifted ("Approved -  ready to publish" vs "Ready to
 * publish").
 *
 * The mobile workspace deliberately has no dependency on @noteschain/*, so
 * it mirrors this file rather than importing it (see apps/mobile/src/lib/
 * labels.ts, and config.ts for the same arrangement around `brand.name`).
 * Mirrored-with-a-pointer is still one source of truth; four independent
 * literals is not.
 */
export const DRAFT_STATUS_LABELS: Record<DraftStatus, string> = {
  [DraftStatus.DRAFT]: "Draft",
  [DraftStatus.PENDING_REVIEW]: "Awaiting review",
  [DraftStatus.CHANGES_REQUESTED]: "Changes requested",
  [DraftStatus.REJECTED]: "Rejected",
  [DraftStatus.APPROVED]: "Ready to publish",
  [DraftStatus.CHAIN_PENDING]: "Publishing…",
  [DraftStatus.CHAIN_SUBMITTED]: "Publishing…",
  [DraftStatus.PUBLISHED]: "Published",
  [DraftStatus.CHAIN_FAILED]: "Publishing failed",
  [DraftStatus.ARCHIVED]: "Archived",
};

/**
 * What a byline is, in the reader's words.
 *
 * DESIGN_SYSTEM.md §11 and §12 both specify "Keeper profile". What shipped
 * was three variants at once: "Primary profile" on the web badge, the web
 * profile page, the mobile reader and the mobile profile page; "Keeper
 * profile" in the mobile identity list; and "Your Keeper profile" in the
 * byline picker. "Primary profile" is database language in a product whose
 * §1 principle calls the byline "an invitation, not a footnote".
 */
export const IDENTITY_KIND_LABEL = {
  keeper: "Keeper profile",
  pen: "Pen name",
} as const;

export function identityKindLabel(isPrimary: boolean): string {
  return isPrimary ? IDENTITY_KIND_LABEL.keeper : IDENTITY_KIND_LABEL.pen;
}

/**
 * How recently something was published, in the format §11's card mock uses.
 *
 * Four formats shipped for one field: `10/1/2026` on the web card (a raw
 * toLocaleDateString), `2h ago` on the web byline, `Oct 1, 2026` on the
 * mobile card, and `10/1/2026` again on the mobile reader. The relative
 * formatter already existed in AuthorBadge.tsx; the card simply never passed
 * it a timestamp.
 *
 * `now` is injectable so this is testable without freezing the clock.
 */
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

/** The absolute form, for anything older than a month and for bylines. */
export function formatNoteDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

/** "joined Jan 2025", per §12. */
export function formatJoinedDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { month: "short", year: "numeric" });
}
