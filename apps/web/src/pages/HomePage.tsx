import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { brand } from "@noteschain/shared";
import { Button } from "@/components/ui/button";
import { CanopyGlow } from "@/components/marketing/CanopyGlow";
import { WritingMark } from "@/components/marketing/WritingMark";
import { KeptThoughtCard } from "@/components/marketing/KeptThoughtCard";
import { KEPT_THOUGHTS } from "@/lib/keptThoughts";
import { useScrollReveal } from "@/hooks/useScrollReveal";
import { useCurrentUser } from "@/hooks/useAuth";
import { HomeFeed } from "@/pages/HomeFeed";
import { PageLoader, SESSION_CHECK_LOADER_DELAY_MS } from "@/components/Loader";
import { cn } from "@/lib/utils";

const GALLERY_THOUGHTS = KEPT_THOUGHTS.slice(0, 4);

const FEATURES = [
  {
    title: "Drafts stay yours",
    body: "Every note starts private -  autosaved, versioned, and never public until you choose to submit it.",
  },
  {
    title: "Publish your way",
    body: "Under your own name or a pen name. You decide whether a note is easy to find or reachable only by link.",
  },
  {
    title: "A public record, once you're sure",
    body: "After moderation, you choose whether to publish an approved note permanently on Solana -  verifiable by anyone, forever.",
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
  const { data: user, isLoading } = useCurrentUser();

  // Delayed the same way RequireAuth is, so a warm session check doesn't
  // flash a loader before the feed appears.
  if (isLoading) return <PageLoader label="Loading" delayMs={SESSION_CHECK_LOADER_DELAY_MS} />;
  // Signed-in visitors land on their feed, not the pitch for an account they
  // already have. Marketing copy below is unauthenticated-only.
  if (user) return <HomeFeed />;

  return (
    <div>
      <section className="relative overflow-hidden border-b border-border">
        <CanopyGlow />
        <div className="mx-auto grid max-w-7xl gap-10 px-4 py-12 md:px-8 md:py-20 lg:grid-cols-[minmax(0,1.05fr)_minmax(22rem,0.7fr)] lg:items-center lg:gap-16 lg:py-24">
          <div className="max-w-2xl">
            <div className="flex items-start gap-4">
              <div>
                <p className="mb-3 text-sm font-medium text-primary">{brand.name}</p>
                <h1 className="text-3xl leading-tight md:text-5xl lg:text-6xl">{brand.tagline}</h1>
              </div>
              <WritingMark className="mt-1 hidden h-16 w-14 shrink-0 text-verified md:block" />
            </div>
            <p className="mt-5 max-w-reading text-body text-muted-foreground md:text-lg">
              Write privately. Publish intentionally. Keep meaningful notes verifiable.
            </p>

            <div className="mt-8 flex flex-wrap gap-3">
              <Button asChild size="lg">
                <Link to="/register">Start writing</Link>
              </Button>
              <Button asChild size="lg" variant="outline">
                <Link to="/explore">Explore notes</Link>
              </Button>
            </div>
          </div>
          <div className="hidden border-l border-border pl-8 lg:block">
            <h2 className="font-display text-xl text-foreground">A thought can stay private until it is ready.</h2>
            <div className="mt-6 grid gap-3">
              {GALLERY_THOUGHTS.slice(0, 2).map((thought) => (
                <KeptThoughtCard key={thought} text={thought} />
              ))}
            </div>
          </div>
        </div>
      </section>

      <RevealSection>
        <div className="mx-auto max-w-7xl px-4 py-14 md:px-8 lg:py-20">
          <h2 className="text-sm font-medium uppercase tracking-wide text-muted-foreground">A few recent notes</h2>
          <div className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {GALLERY_THOUGHTS.map((thought) => (
              <KeptThoughtCard key={thought} text={thought} />
            ))}
          </div>
        </div>
      </RevealSection>

      <RevealSection className="border-y border-border bg-surface-elevated">
        <div className="mx-auto max-w-4xl px-4 py-16 text-center md:px-8 lg:py-24">
          <h2 className="font-display text-balance text-2xl leading-snug md:text-4xl">
            Most of what you write today will be gone by next year.
            <br />A few things shouldn't be.
          </h2>
          <p className="mt-4 text-muted-foreground">That's the whole idea.</p>
        </div>
      </RevealSection>

      <RevealSection>
        <div className="mx-auto grid max-w-7xl gap-8 px-4 py-16 md:px-8 lg:grid-cols-[minmax(16rem,0.7fr)_minmax(0,1.3fr)] lg:gap-16 lg:py-24">
          <div aria-hidden="true" className="hidden items-start lg:flex">
            <WritingMark className="h-24 w-20 text-verified" />
          </div>
          <div className="space-y-6">
          {FEATURES.map((feature) => (
            <div key={feature.title} className="border-l border-border pl-5">
              <h2 className="text-xl">{feature.title}</h2>
              <p className="mt-1 text-muted-foreground">{feature.body}</p>
            </div>
          ))}
            <div className="flex flex-wrap gap-x-6 gap-y-3 pt-2">
              <Link to="/how-it-works" className="inline-block text-sm text-primary underline">
                See exactly how a note is published
              </Link>
              <Link to="/verify" className="inline-block text-sm text-primary underline">
                Verify a note’s public record
              </Link>
            </div>
          </div>
        </div>
      </RevealSection>

    </div>
  );
}
