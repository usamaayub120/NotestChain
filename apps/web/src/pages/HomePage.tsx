import { Link } from "react-router-dom";
import { brand } from "@noteschain/shared";
import { Button } from "@/components/ui/button";

export function HomePage() {
  return (
    <div className="mx-auto max-w-2xl px-4 py-10 md:py-20">
      <p className="mb-3 text-sm font-medium text-primary">{brand.name}</p>
      <h1 className="text-3xl leading-tight md:text-5xl">{brand.tagline}</h1>
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

      <div className="mt-16 space-y-6 border-t border-border pt-10">
        <div>
          <h2 className="text-xl">Drafts stay yours</h2>
          <p className="mt-1 text-muted-foreground">
            Everything you write starts private — autosaved, versioned, and never public until you choose to
            submit it.
          </p>
        </div>
        <div>
          <h2 className="text-xl">Publish your way</h2>
          <p className="mt-1 text-muted-foreground">
            Under your name, a pseudonym, or anonymously. You decide whether it's easy to find or just
            reachable by link.
          </p>
        </div>
        <div>
          <h2 className="text-xl">A public record, once you're sure</h2>
          <p className="mt-1 text-muted-foreground">
            After a quick moderation check, approved thoughts are permanently kept on Solana — verifiable by
            anyone, forever.
          </p>
        </div>
      </div>
    </div>
  );
}
