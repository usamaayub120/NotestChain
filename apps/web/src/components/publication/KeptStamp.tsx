import { cn } from "@/lib/utils";

/**
 * The stamp geometry, with nothing in it about state.
 *
 * DESIGN_SYSTEM.md §6 asks for "a hand-drawn-feel double ring (outer ring
 * hairline, inner ring solid) with a single short diagonal tick inside -
 * deliberately closer to a postal/wax seal mark than a checkmark-in-a-badge".
 * What shipped was one circle, filled solid, with a three-point `M8 12.3
 * L10.6 15 L16 9` polyline knocked out of it: a checkmark in a badge, the
 * exact form §2 names as the thing to avoid, in the slot §2 calls "the one
 * bold, ownable visual idea".
 *
 * The rings are authored as cubic paths rather than <circle>, with each
 * quadrant landing a few hundredths off a true radius. At 20px that reads as
 * a seal pressed by hand; a perfect circle reads as an icon from a set.
 *
 * The tick is one stroke. A second stroke would make it a checkmark again.
 */

/** Outer ring: hairline, slightly out of round. */
const OUTER_RING =
  "M12 1.55 C17.75 1.4 22.6 6.3 22.45 12.15 C22.3 17.85 17.7 22.6 11.9 22.45 C6.2 22.3 1.4 17.6 1.55 11.85 C1.7 6.2 6.35 1.7 12 1.55 Z";

/** Inner ring: solid weight, offset a touch from the outer so they are not concentric. */
const INNER_RING =
  "M12.05 5.1 C15.9 4.95 19.1 8.2 18.95 12.1 C18.8 15.85 15.8 18.95 12 18.9 C8.15 18.85 5.05 15.75 5.1 11.95 C5.15 8.15 8.25 5.2 12.05 5.1 Z";

/** The single short diagonal, low-left to high-right. Short on purpose: run
 *  it the width of the inner ring and it stops reading as a mark pressed
 *  into the seal and starts reading as a slash through it. */
const TICK = "M10.45 13.25 L13.6 10.1";

export type KeptStampTone = "kept" | "pending" | "problem" | "caution";

const TONE_COLOR: Record<KeptStampTone, string> = {
  kept: "rgb(var(--verified))",
  pending: "rgb(var(--muted-foreground))",
  problem: "rgb(var(--destructive))",
  caution: "rgb(var(--warning))",
};

export function KeptStamp({
  tone,
  size = 20,
  label,
  animateIn,
  pulse,
  className,
}: {
  tone: KeptStampTone;
  size?: number;
  label: string;
  animateIn?: boolean;
  pulse?: boolean;
  className?: string;
}) {
  const color = TONE_COLOR[tone];
  // §6: the tick is the mark of something actually kept. While it is still
  // confirming the seal is drawn but unpressed, which says "not yet" without
  // needing a greyed-out copy of the finished state.
  const showTick = tone === "kept";
  const showAlert = tone === "problem" || tone === "caution";

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      className={cn("shrink-0", pulse && "animate-kept-pulse", animateIn && "animate-kept-in", className)}
      aria-label={label}
      role="img"
    >
      <path d={OUTER_RING} stroke={color} strokeWidth={0.9} strokeLinejoin="round" fill="none" />
      <path d={INNER_RING} stroke={color} strokeWidth={1.7} strokeLinejoin="round" fill="none" />
      {showTick && <path d={TICK} stroke={color} strokeWidth={2} strokeLinecap="round" fill="none" />}
      {showAlert && (
        <>
          <path d="M12 8.6 v4.1" stroke={color} strokeWidth={1.8} strokeLinecap="round" />
          <circle cx="12" cy="15.6" r="0.95" fill={color} />
        </>
      )}
    </svg>
  );
}
