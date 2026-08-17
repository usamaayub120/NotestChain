import { useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import { NoteContent } from "@/components/note/NoteContent";
import { brand } from "@noteschain/shared";
import { usePublication, usePublicationRevisions } from "@/hooks/usePublications";
import { AuthorBadge } from "@/components/publication/AuthorBadge";
import { BookmarkButton } from "@/components/publication/BookmarkButton";
import { BlockchainProofSheet } from "@/components/publication/BlockchainProofSheet";
import { ReportPublicationSheet } from "@/components/publication/ReportPublicationSheet";
import { ShareSheet } from "@/components/publication/ShareSheet";
import { CommentSection } from "@/components/publication/CommentSection";
import { ErrorState } from "@/components/ErrorState";
import { apiFetch } from "@/lib/api";
import { PageLoader } from "@/components/Loader";

export function PublicationReaderPage() {
  const { id } = useParams<{ id: string }>();
  const { data: publication, isLoading, isError, refetch } = usePublication(id);
  const { data: revisionData } = usePublicationRevisions(id);

  useEffect(() => {
    if (!id) return;
    const params = new URLSearchParams(window.location.search);
    apiFetch(`/publications/${id}/view`, {
      method: "POST",
      body: {
        utmSource: params.get("utm_source") ?? undefined,
        utmMedium: params.get("utm_medium") ?? undefined,
        utmCampaign: params.get("utm_campaign") ?? undefined,
      },
    }).catch(() => {});
  }, [id]);

  useEffect(() => {
    if (!publication) return;
    document.title = `${publication.title} — ${brand.name}`;
    return () => {
      document.title = `${brand.name} — ${brand.tagline}`;
    };
  }, [publication]);

  if (isLoading) return <PageLoader label="Loading this note" />;
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

      <NoteContent
        source={publication.content}
        // Falls back to PLAINTEXT when absent, which keeps every note
        // published before markdown shipped rendering exactly as it always
        // has. Those are immutable and already hashed.
        format={publication.contentFormat ?? "PLAINTEXT"}
        shimmer
        className="mt-6 text-body leading-relaxed"
      />

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
        <ShareSheet publicationId={publication.id} title={publication.title} />
        <ReportPublicationSheet publicationId={publication.id} />
      </div>

      <CommentSection publication={publication} />
    </article>
  );
}
