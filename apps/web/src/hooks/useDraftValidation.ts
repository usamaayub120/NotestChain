import { useMemo } from "react";
import { LIMITS, charactersOverLimit, markdownToPlainText, utf8ByteLength } from "@noteschain/shared";

/**
 * Live validation for the draft editor, mirroring `draftInputSchema`
 * field-for-field.
 *
 * This runs on every change rather than at submit. That is the whole point:
 * the reported bug was that a writer got no signal at all until they pressed
 * Submit, by which time they had written a long note the system had been
 * cheerfully saving and calling "Saved".
 *
 * It is kept as a plain derived hook rather than react-hook-form on purpose.
 * `useSubmitDraft` POSTs to /drafts/:id/submit with NO body — the server
 * re-reads and validates the persisted row — so there are no form values to
 * collect and submit, and RHF's core value proposition does not apply here.
 * Meanwhile the editor has debounced autosave, per-field metadata
 * persistence, and a server-owned state machine, all three of which fight
 * RHF's model.
 */

export interface DraftFieldErrors {
  title?: string;
  content?: string;
  publicIdentityId?: string;
}

export interface DraftValidation {
  fieldErrors: DraftFieldErrors;
  /** True when every field would pass the submit schema. */
  isValid: boolean;
  /** True when the note is saveable but too long to submit. */
  isOverLength: boolean;
  /** First problem, phrased for the button's status line. */
  blockedReason?: string;
  /** Field to move focus to when submit is attempted while invalid. */
  firstInvalidField?: keyof DraftFieldErrors;
}

export function useDraftValidation(input: {
  title: string;
  content: string;
  identityMode: "NAMED" | "PSEUDONYMOUS" | "ANONYMOUS";
  publicIdentityId: string | null;
}): DraftValidation {
  const { title, content, identityMode, publicIdentityId } = input;

  return useMemo(() => {
    const fieldErrors: DraftFieldErrors = {};

    const trimmedTitle = title.trim();
    if (!trimmedTitle) {
      fieldErrors.title = "Give this note a title.";
    } else {
      const overBy = utf8ByteLength(trimmedTitle) - LIMITS.TITLE_MAX_BYTES;
      if (overBy > 0) {
        fieldErrors.title = `This title is too long by ${overBy} ${overBy === 1 ? "byte" : "bytes"}. Emoji and accented letters take more than one byte each.`;
      }
    }

    const overBy = charactersOverLimit(content, LIMITS.NOTE_BODY_MAX_CHARS);
    const isOverLength = overBy > 0;

    if (isOverLength) {
      fieldErrors.content = `This note is ${overBy.toLocaleString()} ${overBy === 1 ? "character" : "characters"} over the limit. Trim it a little and you're good.`;
    } else if (!content.trim()) {
      fieldErrors.content = "Write something first.";
    } else if (markdownToPlainText(content).trim().length === 0) {
      fieldErrors.content = "This note is only formatting marks — add some words.";
    }

    const needsIdentity = identityMode === "NAMED" || identityMode === "PSEUDONYMOUS";
    if (needsIdentity && !publicIdentityId) {
      fieldErrors.publicIdentityId = "Choose which identity to publish under.";
    }

    // Ordered to match the editor's visual layout, so focus moves to the
    // first problem a reader would reach rather than an arbitrary one.
    const order: (keyof DraftFieldErrors)[] = ["title", "content", "publicIdentityId"];
    const firstInvalidField = order.find((field) => fieldErrors[field]);

    return {
      fieldErrors,
      isValid: firstInvalidField === undefined,
      isOverLength,
      blockedReason: firstInvalidField ? fieldErrors[firstInvalidField] : undefined,
      firstInvalidField,
    };
  }, [title, content, identityMode, publicIdentityId]);
}
