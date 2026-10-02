import type { KeptStampTone } from "./KeptStamp";

/**
 * One derivation of "what is the state of this note's proof", used by both
 * the stamp and §13's line under the byline.
 *
 * They were derived separately at first, and immediately disagreed: the stamp
 * read the chain status while the line read the verification result, so a
 * publication whose chain job had failed permanently rendered a red stamp
 * next to the word "Publishing". Two components describing one fact need one
 * function.
 *
 * Precedence matters and is not obvious:
 *   1. The content contradicts the record. The worst thing this mark can say,
 *      and it outranks everything else.
 *   2. Publishing failed. There is nothing on the record to check against.
 *   3. We could not check. Not the same as "it's wrong" -  §6 gives this
 *      --warning rather than --destructive.
 *   4. Finalized, nothing wrong: kept.
 *   5. Anything else is still on its way.
 */
export interface KeptState {
  tone: KeptStampTone;
  /** For the stamp's aria-label, where it is the only description. */
  shortLabel: string;
  /** For §13's visible line, where the words carry the state. */
  line: string;
  /** True when §6 says to show no mark at all. */
  hidden: boolean;
}

const CONTRADICTED = new Set(["HASH_MISMATCH", "PDA_MISMATCH", "ACCOUNT_NOT_FOUND"]);
const UNCONFIRMED = new Set(["RPC_UNAVAILABLE", "UNSUPPORTED_VERSION", "VERSION_MISMATCH"]);

export function describeKeptState(
  status: string | null | undefined,
  verification?: string | null,
): KeptState {
  // §6: "Not yet submitted for proof -  no stamp shown at all. We never show
  // a greyed-out 'pending chain' badge on cards."
  if (!status || status === "NOT_SUBMITTED" || status === "QUEUED") {
    return { tone: "pending", shortLabel: "", line: "", hidden: true };
  }

  if (verification && CONTRADICTED.has(verification)) {
    return {
      tone: "problem",
      shortLabel: "This note doesn't match the public record",
      line: "Doesn't match the public record",
      hidden: false,
    };
  }

  if (status === "FAILED_RETRYABLE" || status === "FAILED_PERMANENT") {
    return {
      tone: "problem",
      shortLabel: "Publishing failed",
      line: "Publishing didn't finish",
      hidden: false,
    };
  }

  if (verification && UNCONFIRMED.has(verification)) {
    return {
      tone: "caution",
      shortLabel: "We couldn't confirm this right now",
      line: "We couldn't check this right now",
      hidden: false,
    };
  }

  if (status === "FINALIZED" || status === "PUBLISHED") {
    return {
      tone: "kept",
      shortLabel: "Kept on Solana",
      line: "Kept on Solana · Verified",
      hidden: false,
    };
  }

  return {
    tone: "pending",
    shortLabel: "Publishing in progress",
    line: "On its way to the public record",
    hidden: false,
  };
}
