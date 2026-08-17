import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

/**
 * The loading state for the whole product.
 *
 * Three ruled strokes that write themselves in, then breathe — a paragraph
 * appearing on a page. Two constraints shaped this and are worth keeping:
 *
 *   1. **Never a ring.** A conventional circular spinner is off-limits here.
 *      DESIGN_SYSTEM.md §6 makes the Kept Stamp — a small circular mark — the
 *      only motif allowed to represent on-chain proof anywhere in the
 *      product. A spinning ring sitting where content is about to appear
 *      would dilute exactly the mark that is supposed to mean something. The
 *      same reasoning is already written into WritingMark.tsx.
 *   2. **Not database-generated.** The brand asks every screen to feel
 *      "handwritten-considered". A generic spinner is the most
 *      database-generated element there is; strokes being written are the
 *      opposite, and they say what is actually happening — words are on
 *      their way.
 *
 * The strokes draw once via the existing `draw` keyframe and stay drawn; the
 * breath is what signals "still working" on a slow load. Under
 * `prefers-reduced-motion` the global rule in globals.css collapses both to a
 * single ~0ms iteration, which lands on fully-drawn strokes at 0.55 opacity —
 * a calm static mark rather than a blank space.
 */

const STROKES = [
  // Slightly curved rather than ruler-straight, so it reads as written by
  // hand. Lengths vary like real lines of prose, shortest last.
  { d: "M2,6 C22,4.4 46,7.2 70,5.4", length: 70, delay: "0s" },
  { d: "M2,16 C18,14.6 38,17 54,15.4", length: 54, delay: "0.14s" },
  { d: "M2,26 C14,24.8 26,26.6 34,25.6", length: 34, delay: "0.28s" },
];

export function Loader({
  label = "Loading",
  className,
}: {
  /** Announced to screen readers; also shown when `showLabel` is set. */
  label?: string;
  className?: string;
}) {
  return (
    <div
      role="status"
      aria-live="polite"
      className={cn("flex flex-col items-center gap-3 text-muted-foreground", className)}
    >
      <svg
        aria-hidden="true"
        viewBox="0 0 72 32"
        className="h-8 w-[72px] animate-breathe"
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        strokeLinecap="round"
      >
        {STROKES.map((stroke) => (
          <path
            key={stroke.d}
            d={stroke.d}
            className="animate-draw"
            style={
              {
                "--dash-length": stroke.length,
                strokeDasharray: stroke.length,
                animationDelay: stroke.delay,
                // Same `draw` keyframe as WritingMark, quicker tempo. 1.4s
                // suits a marketing flourish you are meant to watch; a loader
                // that takes that long to say anything reads as sluggish.
                // The !important reduced-motion rule still overrides this.
                animationDuration: "0.75s",
              } as React.CSSProperties
            }
          />
        ))}
      </svg>
      {/* The label is for assistive tech only. A visible "Loading…" caption
          is the thing this component replaces — the mark already says it. */}
      <span className="sr-only">{label}</span>
    </div>
  );
}

/**
 * How long a route guard waits before showing anything.
 *
 * A session check against a warm cache resolves in tens of milliseconds. At
 * that speed a loader is a flicker, not information. 250ms is past the point
 * where a person reads the screen as instant, so anything slower than this
 * genuinely benefits from being told something is happening.
 */
export const SESSION_CHECK_LOADER_DELAY_MS = 250;

/**
 * Renders nothing until `delayMs` has passed.
 *
 * For anything that usually resolves fast — a warm cache, a local auth check
 * — showing a loader immediately is worse than showing nothing: it appears
 * and vanishes inside 100ms as a flicker, which reads as a glitch rather than
 * as progress. Waiting a beat means a quick load stays silent and only a
 * genuinely slow one explains itself.
 */
function useAfterDelay(delayMs: number): boolean {
  const [elapsed, setElapsed] = useState(delayMs === 0);

  useEffect(() => {
    if (delayMs === 0) return;
    // Only the timer sets state — nothing runs synchronously in the effect
    // body. Initial state already covers the "not yet elapsed" case, and once
    // the loader is showing it should stay showing rather than flicker back
    // out if the delay were ever re-specified.
    const timer = setTimeout(() => setElapsed(true), delayMs);
    return () => clearTimeout(timer);
  }, [delayMs]);

  return elapsed;
}

/**
 * Full-page loading. Centres in the space below the app chrome rather than
 * in the raw viewport, so the mark does not sit under the fixed top bar on
 * mobile or drift low on desktop.
 */
export function PageLoader({ label, delayMs = 0 }: { label?: string; delayMs?: number }) {
  const show = useAfterDelay(delayMs);
  if (!show) return null;
  return (
    <div className="flex min-h-[60dvh] items-center justify-center px-4">
      <Loader label={label} />
    </div>
  );
}

/** Loading inside a section of an otherwise-rendered page. */
export function SectionLoader({ label, className }: { label?: string; className?: string }) {
  return <Loader label={label} className={cn("py-10", className)} />;
}
