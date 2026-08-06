import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { brand } from "@noteschain/shared";
import { Button } from "@/components/ui/button";
import { CanopyGlow } from "@/components/marketing/CanopyGlow";
import { WritingMark } from "@/components/marketing/WritingMark";
import { KeptThoughtCard } from "@/components/marketing/KeptThoughtCard";
import { KEPT_THOUGHTS } from "@/lib/keptThoughts";
import { useScrollReveal } from "@/hooks/useScrollReveal";
import { cn } from "@/lib/utils";

const GALLERY_THOUGHTS = KEPT_THOUGHTS.slice(0, 4);

const FEATURES = [
  {
    title: "Drafts stay yours",
    body: "Everything you write starts private — autosaved, versioned, and never public until you choose to submit it.",
  },
  {
    title: "Publish your way",
    body: "Under your name, a pseudonym, or anonymously. You decide whether it's easy to find or just reachable by link.",
  },
  {
    title: "A public record, once you're sure",
    body: "After a quick moderation check, approved thoughts are permanently kept on Solana — verifiable by anyone, forever.",
  },
];

function RevealSection({ children, className }: { children: ReactNode; className?: string }) {
  const { ref, isVisible } = useScrollReveal<HTMLDivElement>();
  return (
    <div
      ref={ref}
      className={cn(
        "transition-all duration-700 ease-out",
        isVisible ? "translate-y-0 opacity-100" : "translate-y-4 opacity-0",
        className,
      )}
    >
      {children}
    </div>
  );
}

export function HomePage() {
  return (
    <div>
      <section className="relative overflow-hidden">
        <CanopyGlow />
        <div className="mx-auto max-w-2xl px-4 py-10 md:py-20">
          <div className="flex items-start gap-4">
            <div>
              <p className="mb-3 text-sm font-medium text-primary">{brand.name}</p>
              <h1 className="text-3xl leading-tight md:text-5xl">{brand.tagline}</h1>
            </div>
            <WritingMark className="mt-1 hidden h-16 w-14 shrink-0 text-verified md:block" />
          </div>
          <p className="mt-4 max-w-reading text-body text-muted-foreground md:text-lg">
            Write privately. Publish intentionally. Keep meaningful thoughts verifiable.
          </p>

          <div className="mt-8 flex flex-wrap gap-3">
            <Button asChild size="lg">
              <Link to="/register">Start writing</Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <Link to="/explore">Explore thoughts</Link>
            </Button>
          </div>
        </div>
      </section>

      <RevealSection className="border-t border-border">
        <div className="mx-auto max-w-2xl px-4 py-14">
          <h2 className="text-sm font-medium uppercase tracking-wide text-muted-foreground">A few kept thoughts</h2>
          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            {GALLERY_THOUGHTS.map((thought) => (
              <KeptThoughtCard key={thought} text={thought} />
            ))}
          </div>
        </div>
      </RevealSection>

      <RevealSection className="border-t border-border bg-surface-elevated">
        <div className="mx-auto max-w-2xl px-4 py-16 text-center">
          <p className="font-display text-2xl leading-snug md:text-4xl">
            Most of what you think today will be gone by next year.
            <br />A few things shouldn't be.
          </p>
          <p className="mt-4 text-muted-foreground">That's the whole idea.</p>
        </div>
      </RevealSection>

      <RevealSection className="border-t border-border">
        <div className="mx-auto max-w-2xl space-y-6 px-4 py-14">
          {FEATURES.map((feature) => (
            <div key={feature.title}>
              <h2 className="text-xl">{feature.title}</h2>
              <p className="mt-1 text-muted-foreground">{feature.body}</p>
            </div>
          ))}
        </div>
      </RevealSection>

      <RevealSection className="border-t border-border">
        <div className="mx-auto max-w-2xl px-4 py-16 text-center">
          <h2 className="font-display text-2xl md:text-3xl">Something worth keeping, right now?</h2>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <Button asChild size="lg">
              <Link to="/register">Start writing</Link>
            </Button>
          </div>
        </div>
      </RevealSection>
    </div>
  );
}
