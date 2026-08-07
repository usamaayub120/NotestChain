import { useState } from "react";
import { Link } from "react-router-dom";
import { brand } from "@noteschain/shared";
import { pickKeptThought } from "@/lib/keptThoughts";

/**
 * The one place a small "kept thought" shows up on every public page —
 * quiet, not a banner. Only rendered on reader-facing routes; see
 * AppShell for exactly which ones (utility screens like the draft editor
 * or admin stay footer-free so it never fights with working screens).
 */
export function Footer() {
  const [thought] = useState(() => pickKeptThought(Math.floor(Math.random() * 1000)));

  return (
    <footer className="mt-auto bg-canopy text-canopy-foreground">
      <div className="mx-auto max-w-2xl px-4 py-10">
        <div className="flex flex-wrap items-baseline justify-between gap-4">
          <div>
            <p className="font-display text-lg font-semibold">{brand.name}</p>
            <p className="mt-1 text-sm text-canopy-foreground/70">{brand.tagline}</p>
          </div>
          <nav aria-label="Footer" className="flex gap-4 text-sm text-canopy-foreground/80">
            <Link to="/" className="hover:text-canopy-foreground">
              Home
            </Link>
            <Link to="/explore" className="hover:text-canopy-foreground">
              Explore
            </Link>
            <Link to="/search" className="hover:text-canopy-foreground">
              Search
            </Link>
            <Link to="/how-it-works" className="hover:text-canopy-foreground">
              How it works
            </Link>
          </nav>
        </div>

        <p className="mt-8 hidden max-w-sm font-sans text-sm italic text-canopy-foreground/60 sm:block">
          {thought}
        </p>
      </div>
    </footer>
  );
}
