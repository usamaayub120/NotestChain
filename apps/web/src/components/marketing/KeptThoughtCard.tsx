import { cn } from "@/lib/utils";

/**
 * A single illustrative line, styled to feel found rather than designed.
 * Deliberately has no author, avatar, or username — these are ours, not
 * fabricated user testimonials (see .claude/skills/noteschain-copywriter).
 */
export function KeptThoughtCard({ text, className }: { text: string; className?: string }) {
  return (
    <figure className={cn("rounded-lg border border-border bg-surface p-5 shadow-sm", className)}>
      <span aria-hidden="true" className="mb-3 block h-1 w-8 rounded-full bg-verified" />
      <blockquote className="font-sans text-lg italic leading-snug text-foreground md:text-xl">
        {text}
      </blockquote>
    </figure>
  );
}
