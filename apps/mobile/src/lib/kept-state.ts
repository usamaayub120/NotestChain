/**
 * Mirrors apps/web/src/components/publication/keptState.ts.
 *
 * Kept as a parallel file for the same reason as limits.ts and config.ts:
 * the mobile workspace deliberately has no dependency on @noteschain/*. The
 * precedence and the wording are deliberately identical, because the two
 * clients describing the same note's proof differently is itself the bug
 * this was written to avoid.
 */
export type KeptTone = "kept" | "pending" | "problem" | "caution";

export interface KeptState {
  tone: KeptTone;
  /** For the stamp's accessibilityLabel, where it is the only description. */
  shortLabel: string;
  /** For the visible line, where the words carry the state. */
  line: string;
  /** DESIGN_SYSTEM.md §6: nothing unsubmitted carries the mark at all. */
  hidden: boolean;
}

const CONTRADICTED = ["HASH_MISMATCH", "PDA_MISMATCH", "ACCOUNT_NOT_FOUND"];
const UNCONFIRMED = ["RPC_UNAVAILABLE", "UNSUPPORTED_VERSION", "VERSION_MISMATCH"];

export function describeKeptState(status?: string | null, verification?: string | null): KeptState {
  if (!status || status === "NOT_SUBMITTED" || status === "QUEUED") {
    return { tone: "pending", shortLabel: "", line: "", hidden: true };
  }
  if (verification && CONTRADICTED.includes(verification)) {
    return {
      tone: "problem",
      shortLabel: "This note doesn't match the public record",
      line: "Doesn't match the public record",
      hidden: false,
    };
  }
  if (status === "FAILED_RETRYABLE" || status === "FAILED_PERMANENT") {
    return { tone: "problem", shortLabel: "Publishing failed", line: "Publishing didn't finish", hidden: false };
  }
  if (verification && UNCONFIRMED.includes(verification)) {
    return {
      tone: "caution",
      shortLabel: "We couldn't confirm this right now",
      line: "We couldn't check this right now",
      hidden: false,
    };
  }
  if (status === "FINALIZED" || status === "PUBLISHED") {
    return { tone: "kept", shortLabel: "Kept on Solana", line: "Kept on Solana · Verified", hidden: false };
  }
  return { tone: "pending", shortLabel: "Publishing in progress", line: "On its way to the public record", hidden: false };
}
