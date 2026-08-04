import { Link } from "react-router-dom";
import type { Publication } from "@/hooks/usePublications";
import { AuthorBadge } from "./AuthorBadge";
import { VerificationBadge } from "./VerificationBadge";

export function PublicationCard({ publication }: { publication: Publication }) {
  return (
    <Link
      to={`/p/${publication.id}`}
      className="publication-card relative block rounded-md border border-border bg-surface p-4 shadow-sm transition-shadow hover:shadow-md"
    >
      <div className="flex items-start justify-between gap-2">
        <AuthorBadge author={publication.author} linkToProfile={false} />
        <VerificationBadge status={publication.chain?.status} size={18} />
      </div>

      <p className="mt-3 line-clamp-4 text-body text-foreground">
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

      <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
        <time dateTime={publication.createdAt}>{new Date(publication.createdAt).toLocaleDateString()}</time>
        {publication.status !== "PUBLISHED" && (
          <span className="rounded-full bg-muted px-2 py-0.5">Publishing…</span>
        )}
      </div>
    </Link>
  );
}
