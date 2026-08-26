import { useState } from "react";
import { Link } from "react-router-dom";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { TurnstileWidget } from "@/components/TurnstileWidget";
import { useCurrentUser } from "@/hooks/useAuth";
import { useCreateComment } from "@/hooks/useComments";
import { useIdentities } from "@/hooks/useIdentities";
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
  const { data: identities } = useIdentities();
  const createComment = useCreateComment();
  const [body, setBody] = useState("");
  // Undefined until the commenter deliberately picks something; defaults to
  // the Keeper profile below, computed rather than synced via an effect.
  const [manualIdentityId, setManualIdentityId] = useState<string | undefined>(undefined);
  const [captchaToken, setCaptchaToken] = useState("");
  const [error, setError] = useState<string | null>(null);

  const publicIdentityId = manualIdentityId ?? identities?.find((identity) => identity.isPrimary)?.id ?? "";

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

  async function submit() {
    setError(null);
    try {
      await createComment.mutateAsync({ publicationId, body, parentCommentId, publicIdentityId, captchaToken });
      setBody("");
      onDone?.();
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Something went wrong.");
    }
  }

  const canSubmit = body.trim().length > 0 && !!captchaToken && !!publicIdentityId;

  return (
    <div className="space-y-2">
      <Textarea
        autoFocus={autoFocus}
        rows={3}
        placeholder="Write a comment…"
        value={body}
        onChange={(e) => setBody(e.target.value)}
      />

      {identities && identities.length > 1 && (
        <label className="flex items-center gap-2 text-sm">
          <span className="text-muted-foreground">Comment as</span>
          <select
            className="h-9 rounded-md border border-input bg-background px-2 text-sm"
            value={publicIdentityId}
            onChange={(e) => setManualIdentityId(e.target.value)}
          >
            {identities.map((identity) => (
              <option key={identity.id} value={identity.id}>
                {identity.displayName} {identity.isPrimary ? "· Keeper profile" : "· Pen name"}
              </option>
            ))}
          </select>
        </label>
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
