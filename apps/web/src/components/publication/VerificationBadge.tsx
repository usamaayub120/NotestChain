import { useEffect, useRef, useState } from "react";

import { cn } from "@/lib/utils";

function isFinalizedStatus(status: string | null | undefined) {
  return status === "FINALIZED" || status === "PUBLISHED";
}

/** The "Kept Stamp" — the one motif allowed to represent blockchain proof
 * anywhere in the product. See DESIGN_SYSTEM.md §6. */
export function VerificationBadge({
  status,
  size = 20,
  className,
}: {
  status: string | null | undefined;
  size?: number;
  className?: string;
}) {
  // Only the *transition* into a finalized status (a live verification call
  // resolving while this badge is mounted) should play the enter animation —
  // a badge that's already finalized on first render (e.g. a card fetched
  // from a list) must render statically. See DESIGN_SYSTEM.md §6: "never on
  // every render — no ambient animation."
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

  if (!status || status === "NOT_SUBMITTED" || status === "QUEUED") return null;

  const isFinalized = isFinalizedStatus(status);
  const isFailed = status === "FAILED_RETRYABLE" || status === "FAILED_PERMANENT";
  const isConfirming = !isFinalized && !isFailed;

  const color = isFinalized
    ? "rgb(var(--verified))"
    : isFailed
      ? "rgb(var(--destructive))"
      : "rgb(var(--muted-foreground))";

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      className={cn(
        "shrink-0",
        isConfirming && "animate-kept-pulse",
        isFinalized && justVerified && "animate-kept-in",
        className
      )}
      aria-label={isFinalized ? "Kept on Solana" : isFailed ? "Publishing failed" : "Publishing in progress"}
      role="img"
    >
      <circle cx="12" cy="12" r="10.5" stroke={color} strokeWidth={isFinalized ? 0 : 1.4} fill={isFinalized ? color : "none"} />
      {isFinalized ? (
        <path d="M8 12.3 L10.6 15 L16 9" stroke="rgb(var(--verified-foreground))" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" fill="none" />
      ) : isFailed ? (
        <path d="M12 7v6" stroke={color} strokeWidth={1.6} strokeLinecap="round" />
      ) : null}
      {isFailed && <circle cx="12" cy="16" r="0.9" fill={color} />}
    </svg>
  );
}
