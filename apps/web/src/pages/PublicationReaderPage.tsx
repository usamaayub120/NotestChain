import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { NoteContent } from "@/components/note/NoteContent";
import { brand } from "@noteschain/shared";
import { usePublication, usePublicationRevisions } from "@/hooks/usePublications";
import { AuthorBadge } from "@/components/publication/AuthorBadge";
import { BookmarkButton } from "@/components/publication/BookmarkButton";
import { KeptLine } from "@/components/publication/KeptLine";
import { ReportPublicationSheet } from "@/components/publication/ReportPublicationSheet";
import { ShareSheet } from "@/components/publication/ShareSheet";
import { CommentSection } from "@/components/publication/CommentSection";
import { ErrorState } from "@/components/ErrorState";
import { apiFetch } from "@/lib/api";
import { PageLoader } from "@/components/Loader";
import { cn } from "@/lib/utils";
import { Languages } from "lucide-react";

export function PublicationReaderPage() {
  const { id } = useParams<{ id: string }>();
  const { data: publication, isLoading, isError, refetch } = usePublication(id);
  const { data: revisionData } = usePublicationRevisions(id);

  // Translation state
  const [isTranslating, setIsTranslating] = useState(false);
  const [translatedContent, setTranslatedContent] = useState<string>('');
  const [showTranslation, setShowTranslation] = useState(false);
  const [translationError, setTranslationError] = useState<string | null>(null);

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
    document.title = `${publication.title} -  ${brand.name}`;
    return () => {
      document.title = `${brand.name} -  ${brand.tagline}`;
    };
  }, [publication]);

  /** Translate the publication content using a translation API */
  const handleTranslate = async () => {
    if (!publication || isTranslating) return;

    setIsTranslating(true);
    setTranslationError(null);

    try {
      // In a real implementation, you would use a translation API like:
      // - Google Translate API
      // - Microsoft Translator Text API
      // - DeepL API
      // - LibreTranslate (open source)
      //
      // For this implementation, we'll use a placeholder endpoint
      // In production, this should be routed through your backend to protect API keys

      const response = await fetch('/api/v1/translate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          text: publication.content,
          targetLang: 'es', // Example: translating to Spanish
        }),
      });

      if (!response.ok) {
        throw new Error(`Translation failed: ${response.status}`);
      }

      const data = await response.json();
      setTranslatedContent(data.translatedText || '');
      setShowTranslation(true);
    } catch (err) {
      setTranslationError(err instanceof Error ? err.message : 'Translation failed');
      console.error('Translation error:', err);
    } finally {
      setIsTranslating(false);
    }
  };

  if (isLoading) return <PageLoader label="Loading this note" />;
  if (isError || !publication) return <ErrorState message="This publication couldn't be found." onRetry={() => refetch()} />;

  return (
    <article className="mx-auto max-w-reading px-4 py-8">
      {publication.discoverability === "UNLISTED" && (
        <p className="mb-4 rounded-md bg-muted px-3 py-2 text-xs text-muted-foreground">
          Unlisted -  not shown in search or Explore, but reachable by this link.
        </p>
      )}

      <h1 className="font-display text-3xl">{publication.title}</h1>

      <div className="mt-3">
        <AuthorBadge author={publication.author} timestamp={publication.createdAt} size="reader" />
      </div>

      <KeptLine publication={publication} />

      {showTranslation && translatedContent ? (
        <NoteContent
          source={translatedContent}
          format="PLAINTEXT"
          shimmer
          className="mt-6 text-body leading-relaxed"
        />
      ) : (
        <NoteContent
          source={publication.content}
          // Falls back to PLAINTEXT when absent, which keeps every note
          // published before markdown shipped rendering exactly as it always
          // has. Those are immutable and already hashed.
          format={publication.contentFormat ?? "PLAINTEXT"}
          shimmer
          className="mt-6 text-body leading-relaxed"
        />
      )}

      {translationError && (
        <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-md text-sm text-red-600">
          Translation error: {translationError}
        </div>
      )}

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
        <ShareSheet publicationId={publication.id} title={publication.title} />
        <button
          type="button"
          disabled={isTranslating || !publication}
          onClick={handleTranslate}
          className={cn(
            "flex size-11 items-center justify-center rounded-md text-muted-foreground",
            "transition-colors duration-150 ease-out",
            "md:hover:bg-muted md:hover:text-foreground",
            "active:bg-muted",
            "disabled:pointer-events-none disabled:opacity-50",
            isTranslating && "bg-muted text-foreground",
          )}
        >
          {isTranslating ? (
            <>
              <span className="sr-only">Translating...</span>
              <svg className="animate-spin -ml-1 mr-3 h-4 w-4 text-current" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"></path>
              </svg>
            </>
          ) : (
            <>
              <Languages size={20} strokeWidth={1.75} aria-hidden />
              <span className="ml-1">Translate</span>
            </>
          )}
          <span className="sr-only">
            {isTranslating ? 'Translating...' : 'Translate publication'}
          </span>
        </button>
        <ReportPublicationSheet publicationId={publication.id} />
      </div>

      <CommentSection publication={publication} />
    </article>
  );
}
