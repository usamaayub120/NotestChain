import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ChevronLeft } from "lucide-react";
import {
  useApproveSubmission,
  useRejectSubmission,
  useRequestChangesSubmission,
  useSubmissionDetail,
} from "@/hooks/useModeration";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ErrorState } from "@/components/ErrorState";
import { CardSkeletonList } from "@/components/CardSkeleton";
import { ConfirmActionDialog } from "@/components/admin/ConfirmActionDialog";
import { MutationError } from "@/components/admin/MutationError";

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
  const [confirmingReject, setConfirmingReject] = useState(false);

  if (isLoading) return <div className="mx-auto max-w-2xl px-4 py-8"><CardSkeletonList count={1} /></div>;
  if (isError || !data) return <ErrorState onRetry={() => refetch()} />;

  const { submission, priorSubmissions, possibleDuplicates } = data;
  const decided = submission.status !== "PENDING_REVIEW";

  function decide(action: "approve" | "reject" | "request-changes") {
    if (!id || !reason.trim()) return;
    const input = { reason, flaggedPii, flaggedAbuse };
    const mutation = action === "approve" ? approve : action === "reject" ? reject : requestChanges;
    mutation.mutate(
      { id, input },
      {
        onSuccess: () => {
          setConfirmingReject(false);
          navigate("/admin/submissions");
        },
      },
    );
  }

  const isPending = approve.isPending || reject.isPending || requestChanges.isPending;
  const activeError = approve.isError ? approve.error : reject.isError ? reject.error : requestChanges.isError ? requestChanges.error : null;

  return (
    <div className="mx-auto max-w-2xl px-4 py-6">
      <Link
        to="/admin/submissions"
        className="inline-flex min-h-11 items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ChevronLeft size={16} aria-hidden="true" />
        Submissions
      </Link>
      <h1 className="mt-1 text-2xl">{submission.titleSnapshot}</h1>
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
            <label className="flex min-h-11 items-center gap-2 py-2">
              <input
                type="checkbox"
                className="h-4 w-4"
                checked={flaggedPii}
                onChange={(e) => setFlaggedPii(e.target.checked)}
              />
              Flag PII
            </label>
            <label className="flex min-h-11 items-center gap-2 py-2">
              <input
                type="checkbox"
                className="h-4 w-4"
                checked={flaggedAbuse}
                onChange={(e) => setFlaggedAbuse(e.target.checked)}
              />
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
            <Button variant="destructive" onClick={() => setConfirmingReject(true)} disabled={!reason.trim() || isPending}>
              Reject
            </Button>
          </div>
          <MutationError error={activeError} />
        </div>
      )}

      <ConfirmActionDialog
        open={confirmingReject}
        onOpenChange={setConfirmingReject}
        title="Reject this submission?"
        description="The author will see your reason and can revise and resubmit — this does not ban them."
        confirmLabel="Reject"
        pendingLabel="Rejecting…"
        isPending={reject.isPending}
        onConfirm={() => decide("reject")}
      />
    </div>
  );
}
