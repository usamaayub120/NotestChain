import { useParams, Link } from "react-router-dom";
import { usePublication, usePublicationRevisions } from "@/hooks/usePublications";
import { AuthorBadge } from "@/components/publication/AuthorBadge";
import { BookmarkButton } from "@/components/publication/BookmarkButton";
import { BlockchainProofSheet } from "@/components/publication/BlockchainProofSheet";
import { ReportPublicationSheet } from "@/components/publication/ReportPublicationSheet";
import { ErrorState } from "@/components/ErrorState";

export function PublicationReaderPage() {
  const { id } = useParams<{ id: string }>();
  const { data: publication, isLoading, isError, refetch } = usePublication(id);
  const { data: revisionData } = usePublicationRevisions(id);

  if (isLoading) return <div className="px-4 py-8 text-muted-foreground">Loading…</div>;
  if (isError || !publication) return <ErrorState message="This publication couldn't be found." onRetry={() => refetch()} />;

  return (
    <article className="mx-auto max-w-reading px-4 py-8">
      {publication.discoverability === "UNLISTED" && (
        <p className="mb-4 rounded-md bg-muted px-3 py-2 text-xs text-muted-foreground">
          Unlisted — not shown in search or Explore, but reachable by this link.
        </p>
      )}

      <h1 className="font-display text-3xl">{publication.title}</h1>

      <div className="mt-3">
        <AuthorBadge author={publication.author} timestamp={publication.createdAt} />
      </div>

      <div className="mt-6 whitespace-pre-wrap text-body leading-relaxed">{publication.content}</div>

      {publication.tags.length > 0 && (
        <div className="mt-6 flex flex-wrap gap-2">
          {publication.tags.map((tag) => (
            <Link key={tag} to={`/tags/${tag}`} className="rounded-full bg-muted px-3 py-1 text-xs text-muted-foreground">
              #{tag}
            </Link>
          ))}
        </div>
      )}

      {revisionData?.previous && (
        <p className="mt-6 text-sm text-muted-foreground">
          This is a revision of{" "}
          <Link to={`/p/${revisionData.previous.id}`} className="text-primary underline">
            {revisionData.previous.title}
          </Link>
          .
        </p>
      )}
      {revisionData && revisionData.revisions.length > 0 && (
        <p className="mt-2 text-sm text-muted-foreground">
          Revised by:{" "}
          {revisionData.revisions.map((rev, i) => (
            <span key={rev.id}>
              {i > 0 && ", "}
              <Link to={`/p/${rev.id}`} className="text-primary underline">
                {rev.title}
              </Link>
            </span>
          ))}
        </p>
      )}

      <div className="mt-8 flex items-center gap-4 border-t border-border pt-4">
        <BookmarkButton publicationId={publication.id} />
        <BlockchainProofSheet publication={publication} />
        <ReportPublicationSheet publicationId={publication.id} />
      </div>
    </article>
  );
}
