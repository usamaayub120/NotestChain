import { useState } from "react";
import { CommentItem } from "@/components/publication/CommentItem";
import { CommentComposer } from "@/components/publication/CommentComposer";
import { useReplies, type TopLevelCommentDTO } from "@/hooks/useComments";

export function CommentThread({ comment, publicationId }: { comment: TopLevelCommentDTO; publicationId: string }) {
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [showAllReplies, setShowAllReplies] = useState(false);

  const { data: allReplies } = useReplies(comment.id, showAllReplies);
  const replies = showAllReplies && allReplies ? allReplies.data : comment.replies;

  return (
    <div className="rounded-md border border-border bg-surface p-3">
      <CommentItem
        comment={comment}
        publicationId={publicationId}
        onReply={() => setReplyingTo((current) => (current === comment.id ? null : comment.id))}
      />

      {replyingTo === comment.id && (
        <div className="mt-3 ml-4 border-l border-border pl-3">
          <CommentComposer
            publicationId={publicationId}
            parentCommentId={comment.id}
            onDone={() => setReplyingTo(null)}
            autoFocus
          />
        </div>
      )}

      {replies.length > 0 && (
        <div className="mt-3 ml-4 space-y-3 border-l border-border pl-3">
          {replies.map((reply) => (
            <div key={reply.id}>
              <CommentItem
                comment={reply}
                publicationId={publicationId}
                onReply={() => setReplyingTo((current) => (current === reply.id ? null : reply.id))}
              />
              {replyingTo === reply.id && (
                <div className="mt-2">
                  <CommentComposer
                    publicationId={publicationId}
                    parentCommentId={reply.id}
                    onDone={() => setReplyingTo(null)}
                    autoFocus
                  />
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {comment.repliesTruncated && !showAllReplies && (
        <button
          type="button"
          onClick={() => setShowAllReplies(true)}
          className="ml-4 mt-2 pl-3 text-xs text-primary underline"
        >
          View all {comment.repliesTotal} replies
        </button>
      )}
    </div>
  );
}
