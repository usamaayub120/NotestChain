/**
 * A small drawn-on sprig — deliberately linear and open, never a ring, so
 * it can't be confused with the Kept Stamp (DESIGN_SYSTEM.md §6), which is
 * the only motif allowed to represent on-chain verification anywhere in
 * the product. This one means something different: writing, growing,
 * nothing to do with proof.
 */
export function WritingMark({ className }: { className?: string }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 64 80"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
    >
      <path
        d="M14,74 C10,54 26,50 24,36 C22,22 42,26 44,10"
        style={{ "--dash-length": 110, strokeDasharray: 110 } as React.CSSProperties}
        className="animate-draw"
      />
      <path
        d="M22,54 L32,49"
        style={{ "--dash-length": 20, strokeDasharray: 20, animationDelay: "0.5s" } as React.CSSProperties}
        className="animate-draw"
      />
      <path
        d="M26,34 L15,30"
        style={{ "--dash-length": 20, strokeDasharray: 20, animationDelay: "0.75s" } as React.CSSProperties}
        className="animate-draw"
      />
      <path
        d="M38,17 L48,13"
        style={{ "--dash-length": 20, strokeDasharray: 20, animationDelay: "1s" } as React.CSSProperties}
        className="animate-draw"
      />
    </svg>
  );
}
