import { CommentThread } from "@/components/publication/CommentThread";
import { CommentComposer } from "@/components/publication/CommentComposer";
import { CommentsEnabledToggle } from "@/components/publication/CommentsEnabledToggle";
import { useComments } from "@/hooks/useComments";
import type { Publication } from "@/hooks/usePublications";

export function CommentSection({ publication }: { publication: Publication }) {
  const { data, isLoading } = useComments(publication.commentsEnabled ? publication.id : undefined);

  return (
    <div className="mt-8 border-t border-border pt-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg">Comments</h2>
        {publication.viewerIsOwner && (
          <CommentsEnabledToggle publicationId={publication.id} commentsEnabled={publication.commentsEnabled} />
        )}
      </div>

      {!publication.commentsEnabled ? (
        <p className="mt-3 text-sm text-muted-foreground">Comments are off for this publication.</p>
      ) : (
        <>
          <div className="mt-4">
            <CommentComposer publicationId={publication.id} />
          </div>

          {isLoading && <p className="mt-6 text-sm text-muted-foreground">Loading…</p>}
          {!isLoading && data?.data.length === 0 && (
            <p className="mt-6 text-sm text-muted-foreground">Nothing here yet — be the first to comment.</p>
          )}

          <div className="mt-6 space-y-3">
            {data?.data.map((comment) => (
              <CommentThread key={comment.id} comment={comment} publicationId={publication.id} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
