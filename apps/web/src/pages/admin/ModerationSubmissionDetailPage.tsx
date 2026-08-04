import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  useApproveSubmission,
  useRejectSubmission,
  useRequestChangesSubmission,
  useSubmissionDetail,
} from "@/hooks/useModeration";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ErrorState } from "@/components/ErrorState";

export function ModerationSubmissionDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data, isLoading, isError, refetch } = useSubmissionDetail(id);
  const approve = useApproveSubmission();
  const reject = useRejectSubmission();
  const requestChanges = useRequestChangesSubmission();

  const [reason, setReason] = useState("");
  const [flaggedPii, setFlaggedPii] = useState(false);
  const [flaggedAbuse, setFlaggedAbuse] = useState(false);

  if (isLoading) return <div className="px-4 py-8 text-muted-foreground">Loading…</div>;
  if (isError || !data) return <ErrorState onRetry={() => refetch()} />;

  const { submission, priorSubmissions, possibleDuplicates } = data;
  const decided = submission.status !== "PENDING_REVIEW";

  async function decide(action: "approve" | "reject" | "request-changes") {
    if (!id || !reason.trim()) return;
    const input = { reason, flaggedPii, flaggedAbuse };
    if (action === "approve") await approve.mutateAsync({ id, input });
    else if (action === "reject") await reject.mutateAsync({ id, input });
    else await requestChanges.mutateAsync({ id, input });
    navigate("/admin/submissions");
  }

  const isPending = approve.isPending || reject.isPending || requestChanges.isPending;

  return (
    <div className="mx-auto max-w-2xl px-4 py-6">
      <h1 className="text-2xl">{submission.titleSnapshot}</h1>
      <p className="mt-1 text-xs text-muted-foreground">
        {submission.identityModeSnapshot} · {submission.discoverabilitySnapshot} · author{" "}
        {submission.submittedBy.email} ({submission.submittedBy.status})
      </p>

      <div className="mt-4 whitespace-pre-wrap rounded-md border border-border bg-surface p-4 text-body">
        {submission.contentSnapshot}
      </div>

      {submission.tagsSnapshot.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {submission.tagsSnapshot.map((tag) => (
            <span key={tag} className="rounded-full bg-muted px-2 py-0.5 text-xs">
              #{tag}
            </span>
          ))}
        </div>
      )}

      {possibleDuplicates.length > 0 && (
        <div className="mt-4 rounded-md bg-warning/10 px-3 py-2 text-sm">
          Possible duplicate of {possibleDuplicates.length} other submission(s) with identical content.
        </div>
      )}

      {priorSubmissions.length > 0 && (
        <div className="mt-4">
          <h2 className="text-sm font-medium">Previous submissions for this draft</h2>
          <ul className="mt-2 space-y-1 text-sm text-muted-foreground">
            {priorSubmissions.map((s) => (
              <li key={s.id}>
                {s.status} — {new Date(s.createdAt).toLocaleString()}
              </li>
            ))}
          </ul>
        </div>
      )}

      {submission.decisions.length > 0 && (
        <div className="mt-4">
          <h2 className="text-sm font-medium">Moderation history</h2>
          <ul className="mt-2 space-y-2 text-sm">
            {submission.decisions.map((d) => (
              <li key={d.id} className="rounded-md bg-muted p-2">
                <p className="font-medium">
                  {d.action} — {d.moderator.email}
                </p>
                <p className="text-muted-foreground">{d.reason}</p>
              </li>
            ))}
          </ul>
        </div>
      )}

      {!decided && (
        <div className="mt-6 space-y-3 border-t border-border pt-6">
          <Textarea
            placeholder="Reason (required, shown internally — never on-chain)"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={3}
          />
          <div className="flex gap-4 text-sm">
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={flaggedPii} onChange={(e) => setFlaggedPii(e.target.checked)} />
              Flag PII
            </label>
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={flaggedAbuse} onChange={(e) => setFlaggedAbuse(e.target.checked)} />
              Flag abuse
            </label>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button onClick={() => decide("approve")} disabled={!reason.trim() || isPending}>
              Approve
            </Button>
            <Button variant="outline" onClick={() => decide("request-changes")} disabled={!reason.trim() || isPending}>
              Request changes
            </Button>
            <Button variant="destructive" onClick={() => decide("reject")} disabled={!reason.trim() || isPending}>
              Reject
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
