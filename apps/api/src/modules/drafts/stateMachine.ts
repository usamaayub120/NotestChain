import { DraftStatus } from "@noteschain/shared";
import { ApiError } from "../../lib/apiError.js";

export type DraftEvent = "SUBMIT" | "WITHDRAW" | "APPROVE" | "REJECT" | "REQUEST_CHANGES";

// Explicit transition table — nothing outside this map is a legal move.
// Draft.status only ever holds the off-chain-lifecycle subset of
// DraftStatus; CHAIN_* and PUBLISHED apply to Publication.status instead
// (see ARCHITECTURE.md §5).
const TRANSITIONS: Partial<Record<DraftStatus, Partial<Record<DraftEvent, DraftStatus>>>> = {
  [DraftStatus.DRAFT]: {
    SUBMIT: DraftStatus.PENDING_REVIEW,
  },
  [DraftStatus.CHANGES_REQUESTED]: {
    SUBMIT: DraftStatus.PENDING_REVIEW,
  },
  [DraftStatus.PENDING_REVIEW]: {
    WITHDRAW: DraftStatus.DRAFT,
    APPROVE: DraftStatus.APPROVED,
    REJECT: DraftStatus.REJECTED,
    REQUEST_CHANGES: DraftStatus.CHANGES_REQUESTED,
  },
};

export function transitionDraft(current: DraftStatus, event: DraftEvent): DraftStatus {
  const next = TRANSITIONS[current]?.[event];
  if (!next) {
    throw new ApiError(
      409,
      "INVALID_TRANSITION",
      `Cannot ${event.toLowerCase().replace("_", " ")} a draft in status ${current}.`,
    );
  }
  return next;
}

// Deletable without going through moderation: never submitted, or came back
// out of the moderation loop without being approved.
export const DELETABLE_DRAFT_STATUSES: DraftStatus[] = [
  DraftStatus.DRAFT,
  DraftStatus.CHANGES_REQUESTED,
  DraftStatus.REJECTED,
  DraftStatus.ARCHIVED,
];

// Editable off-chain content — anything not currently in front of a
// moderator and not already turned into a publication.
export const EDITABLE_DRAFT_STATUSES: DraftStatus[] = [
  DraftStatus.DRAFT,
  DraftStatus.CHANGES_REQUESTED,
];
