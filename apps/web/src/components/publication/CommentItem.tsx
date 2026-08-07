import { useState } from "react";
import { Flag, Trash2 } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { formatRelative } from "@/components/publication/AuthorBadge";
import { useDeleteComment, useReportComment, type CommentDTO } from "@/hooks/useComments";

export function CommentItem({
  comment,
  publicationId,
  onReply,
}: {
  comment: CommentDTO;
  publicationId: string;
  onReply?: () => void;
}) {
  const deleteComment = useDeleteComment(publicationId);

  if (comment.isRemoved) {
    return <p className="text-sm italic text-muted-foreground">[comment removed]</p>;
  }

  return (
    <div>
      <div className="flex items-center gap-2 text-sm">
        <span className="font-medium text-foreground">{comment.isAnonymous ? "Anonymous" : comment.authorDisplayName}</span>
        <span className="text-muted-foreground" aria-hidden="true">
          ·
        </span>
        <time dateTime={comment.createdAt} className="text-muted-foreground">
          {formatRelative(comment.createdAt)}
        </time>
      </div>
      <p className="mt-1 whitespace-pre-wrap text-sm">{comment.body}</p>
      <div className="mt-1 flex items-center gap-3 text-xs text-muted-foreground">
        {onReply && (
          <button type="button" onClick={onReply} className="hover:text-foreground">
            Reply
          </button>
        )}
        {comment.isOwn ? (
          <button
            type="button"
            onClick={() => deleteComment.mutate(comment.id)}
            disabled={deleteComment.isPending}
            className="flex items-center gap-1 hover:text-destructive"
          >
            <Trash2 size={12} /> Delete
          </button>
        ) : (
          <CommentReportTrigger commentId={comment.id} />
        )}
      </div>
    </div>
  );
}

function CommentReportTrigger({ commentId }: { commentId: string }) {
  const [reason, setReason] = useState("");
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState<"idle" | "sending" | "sent">("idle");
  const reportComment = useReportComment();

  async function submit() {
    setStatus("sending");
    try {
      await reportComment.mutateAsync({ commentId, reason });
      setStatus("sent");
    } catch {
      setStatus("idle");
    }
  }

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <button type="button" className="flex items-center gap-1 hover:text-foreground">
          <Flag size={12} /> Report
        </button>
      </SheetTrigger>
      <SheetContent side="bottom">
        <SheetHeader>
          <SheetTitle>Report this comment</SheetTitle>
        </SheetHeader>
        {status === "sent" ? (
          <p className="mt-4 text-sm text-muted-foreground">Thanks — a moderator will take a look.</p>
        ) : (
          <>
            <Textarea
              className="mt-4"
              rows={4}
              placeholder="What's wrong with this comment?"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
            <Button className="mt-3 w-full" onClick={submit} disabled={!reason.trim() || status === "sending"}>
              {status === "sending" ? "Sending…" : "Send report"}
            </Button>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
