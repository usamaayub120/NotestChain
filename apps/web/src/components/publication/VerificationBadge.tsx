import { cn } from "@/lib/utils";

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
  if (!status || status === "NOT_SUBMITTED" || status === "QUEUED") return null;

  const isFinalized = status === "FINALIZED" || status === "PUBLISHED";
  const isFailed = status === "FAILED_RETRYABLE" || status === "FAILED_PERMANENT";

  const color = isFinalized ? "var(--verified)" : isFailed ? "var(--destructive)" : "var(--muted-foreground)";

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      className={cn("shrink-0", className)}
      aria-label={isFinalized ? "Kept on Solana" : isFailed ? "Publishing failed" : "Publishing in progress"}
      role="img"
    >
      <circle cx="12" cy="12" r="10.5" stroke={color} strokeWidth={isFinalized ? 0 : 1.4} fill={isFinalized ? color : "none"} />
      {isFinalized ? (
        <path d="M8 12.3 L10.6 15 L16 9" stroke="var(--verified-foreground)" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" fill="none" />
      ) : isFailed ? (
        <path d="M12 7v6" stroke={color} strokeWidth={1.6} strokeLinecap="round" />
      ) : null}
      {isFailed && <circle cx="12" cy="16" r="0.9" fill={color} />}
    </svg>
  );
}
