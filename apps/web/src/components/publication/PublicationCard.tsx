import { Link } from "react-router-dom";
import type { Publication } from "@/hooks/usePublications";
import { AuthorBadge } from "./AuthorBadge";
import { VerificationBadge } from "./VerificationBadge";

export function PublicationCard({ publication }: { publication: Publication }) {
  return (
    <Link
      to={`/p/${publication.id}`}
      className="publication-card relative block rounded-md border border-border bg-surface p-4 shadow-sm transition-shadow md:hover:shadow-md"
    >
      <div className="flex items-start justify-between gap-2">
        {/* `timestamp` was never passed, so AuthorBadge's formatRelative -
            which exists and is the format §11's card mock specifies -  never
            ran, and the card fell back to a raw toLocaleDateString() below. */}
        <AuthorBadge author={publication.author} timestamp={publication.publishedAt ?? publication.createdAt} linkToProfile={false} />
        <VerificationBadge status={publication.chain?.status} size={18} />
      </div>

      {/* The card rendered byline, excerpt, tags and date and never the
          title, so every feed in the product -  Home, Explore, Search, Tag,
          Bookmarks, Profile -  was scannable by body text alone, and the
          link's accessible name was the whole card.

          h2 rather than h3: the page heading is the h1 and each card is a
          top-level item under it, so h3 skips a level and breaks the
          document outline screen readers navigate by. */}
      {publication.title && (
        <h2 className="mt-3 font-display text-lg font-semibold leading-snug text-foreground">{publication.title}</h2>
      )}

      <p className="mt-1.5 line-clamp-3 text-body text-muted-foreground">
        {publication.highlight ? (
          <span dangerouslySetInnerHTML={{ __html: publication.highlight }} />
        ) : (
          publication.excerpt
        )}
      </p>

      {publication.tags.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {publication.tags.map((tag) => (
            <span key={tag} className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
              #{tag}
            </span>
          ))}
        </div>
      )}

      {publication.status !== "PUBLISHED" && (
        <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
          <span className="rounded-full bg-muted px-2 py-0.5">Publishing…</span>
        </div>
      )}
    </Link>
  );
}
