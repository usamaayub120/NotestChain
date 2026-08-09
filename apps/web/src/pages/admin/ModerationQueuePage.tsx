import { Link } from "react-router-dom";
import { usePendingSubmissions } from "@/hooks/useModeration";
import { EmptyState } from "@/components/EmptyState";
import { CardSkeletonList } from "@/components/CardSkeleton";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";

export function ModerationQueuePage() {
  const { data: submissions, isLoading } = usePendingSubmissions();

  return (
    <div className="mx-auto max-w-2xl px-4 py-6">
      <AdminPageHeader title="Submissions" description="Oldest first." />

      {isLoading && <div className="mt-6"><CardSkeletonList /></div>}
      {!isLoading && submissions?.length === 0 && (
        <EmptyState title="Nothing pending" description="The queue is empty right now." />
      )}

      <ul className="mt-6 space-y-2">
        {submissions?.map((submission) => (
          <li key={submission.id}>
            <Link
              to={`/admin/submissions/${submission.id}`}
              className="block rounded-md border border-border bg-surface p-4 hover:bg-muted"
            >
              <p className="font-medium">{submission.titleSnapshot}</p>
              <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{submission.contentSnapshot}</p>
              <p className="mt-2 text-xs text-muted-foreground">
                {submission.identityModeSnapshot} · submitted {new Date(submission.createdAt).toLocaleString()}
              </p>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
