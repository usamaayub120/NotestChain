import { useEffect, useRef, useState } from "react";

import { KeptStamp } from "./KeptStamp";
import { describeKeptState } from "./keptState";

function isFinalizedStatus(status: string | null | undefined) {
  return status === "FINALIZED" || status === "PUBLISHED";
}

/**
 * States a live verification call can report, as modelled by
 * BlockchainProofSheet. Optional: a feed card only knows the chain status,
 * because verifying every card would mean an RPC round trip per row.
 */
export type VerificationState =
  | "VERIFIED"
  | "NOT_FINALIZED"
  | "ACCOUNT_NOT_FOUND"
  | "HASH_MISMATCH"
  | "PDA_MISMATCH"
  | "UNSUPPORTED_VERSION"
  | "VERSION_MISMATCH"
  | "RPC_UNAVAILABLE";

/**
 * The Kept Stamp in context. See DESIGN_SYSTEM.md §6 for the states.
 *
 * `verification` is separate from `status` on purpose. The badge used to
 * receive only `publication.chain?.status` -  a *publishing* status -  and
 * derived its "mismatch" state from FAILED_RETRYABLE / FAILED_PERMANENT. A
 * publication that published perfectly well and then failed to verify
 * (HASH_MISMATCH, the single most important thing this mark can say) rendered
 * as an ordinary kept stamp, because the badge never saw the verification
 * result at all.
 */
export function VerificationBadge({
  status,
  verification,
  size = 20,
  className,
}: {
  status: string | null | undefined;
  /** Typed as a plain string: the API returns VerificationState values but
   *  the DTO is not narrowed, and an unknown state must stay renderable. */
  verification?: string | null;
  size?: number;
  className?: string;
}) {
  // Only the *transition* into a finalized status (a live verification call
  // resolving while this badge is mounted) should play the enter animation;
  // a badge that's already finalized on first render (e.g. a card fetched
  // from a list) must render statically. See DESIGN_SYSTEM.md §6: "never on
  // every render -  no ambient animation."
  const prevStatusRef = useRef(status);
  const [justVerified, setJustVerified] = useState(false);

  useEffect(() => {
    const wasFinalized = isFinalizedStatus(prevStatusRef.current);
    const isNowFinalized = isFinalizedStatus(status);
    if (!wasFinalized && isNowFinalized) {
      setJustVerified(true);
    }
    prevStatusRef.current = status;
  }, [status]);

  const state = describeKeptState(status, verification);
  if (state.hidden) return null;

  return (
    <KeptStamp
      tone={state.tone}
      size={size}
      label={state.shortLabel}
      pulse={state.tone === "pending"}
      animateIn={state.tone === "kept" && justVerified}
      className={className}
    />
  );
}
