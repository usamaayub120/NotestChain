import { useState } from "react";
import { Link } from "react-router-dom";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { TurnstileWidget } from "@/components/TurnstileWidget";
import { useCurrentUser } from "@/hooks/useAuth";
import { useCreateComment } from "@/hooks/useComments";
import { ApiClientError } from "@/lib/api";

export function CommentComposer({
  publicationId,
  parentCommentId,
  onDone,
  autoFocus,
}: {
  publicationId: string;
  parentCommentId?: string;
  onDone?: () => void;
  autoFocus?: boolean;
}) {
  const { data: user } = useCurrentUser();
  const createComment = useCreateComment();
  const [body, setBody] = useState("");
  const [isAnonymous, setIsAnonymous] = useState(false);
  const [displayName, setDisplayName] = useState("");
  const [captchaToken, setCaptchaToken] = useState("");
  const [error, setError] = useState<string | null>(null);

  if (!user) {
    return (
      <p className="text-sm text-muted-foreground">
        <Link to="/login" className="text-primary underline">
          Sign in
        </Link>{" "}
        to leave a comment.
      </p>
    );
  }

  const needsDisplayName = !isAnonymous && !user.commentDisplayName;

  async function submit() {
    setError(null);
    try {
      await createComment.mutateAsync({
        publicationId,
        body,
        parentCommentId,
        isAnonymous,
        displayName: needsDisplayName ? displayName : undefined,
        captchaToken,
      });
      setBody("");
      setDisplayName("");
      onDone?.();
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Something went wrong.");
    }
  }

  const canSubmit = body.trim().length > 0 && !!captchaToken && (!needsDisplayName || displayName.trim().length > 0);

  return (
    <div className="space-y-2">
      <Textarea
        autoFocus={autoFocus}
        rows={3}
        placeholder="Write a comment…"
        value={body}
        onChange={(e) => setBody(e.target.value)}
      />

      <label className="flex items-center gap-2 text-sm text-muted-foreground">
        <input
          type="checkbox"
          checked={isAnonymous}
          onChange={(e) => setIsAnonymous(e.target.checked)}
          className="h-4 w-4"
        />
        Comment anonymously
      </label>

      {needsDisplayName && (
        <Input
          placeholder="Name to comment under"
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          maxLength={60}
        />
      )}

      <TurnstileWidget onVerify={setCaptchaToken} />

      {error && (
        <p role="alert" className="text-sm font-medium text-destructive">
          {error}
        </p>
      )}

      <div className="flex items-center gap-2">
        <Button size="sm" onClick={submit} disabled={!canSubmit || createComment.isPending}>
          {createComment.isPending ? "Posting…" : "Post"}
        </Button>
        {onDone && (
          <Button size="sm" variant="outline" onClick={onDone}>
            Cancel
          </Button>
        )}
      </div>
    </div>
  );
}
