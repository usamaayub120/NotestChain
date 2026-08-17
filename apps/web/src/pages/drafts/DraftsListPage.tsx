import { Link } from "react-router-dom";
import { PenSquare } from "lucide-react";
import { useDrafts } from "@/hooks/useDrafts";
import { useStartNewDraft } from "@/hooks/useStartNewDraft";
import { EmptyState } from "@/components/EmptyState";
import { CardSkeletonList } from "@/components/CardSkeleton";
import { Button } from "@/components/ui/button";
import { markdownToPlainText } from "@noteschain/shared";

const STATUS_LABELS: Record<string, string> = {
  DRAFT: "Draft",
  PENDING_REVIEW: "Awaiting review",
  CHANGES_REQUESTED: "Changes requested",
  REJECTED: "Rejected",
  APPROVED: "Approved — ready to publish",
  CHAIN_PENDING: "Publishing…",
  CHAIN_SUBMITTED: "Publishing…",
  PUBLISHED: "Published",
  CHAIN_FAILED: "Publishing failed",
  ARCHIVED: "Archived",
};

export function DraftsListPage() {
  const { data: drafts, isLoading } = useDrafts();
  const { start: startNewDraft, isPending: isStarting } = useStartNewDraft();

  return (
    <div className="mx-auto max-w-2xl px-4 py-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl">Your drafts</h1>
        <Button size="sm" onClick={() => startNewDraft()} disabled={isStarting}>
          <PenSquare size={16} /> New
        </Button>
      </div>

      {isLoading && <div className="mt-6"><CardSkeletonList /></div>}

      {!isLoading && (!drafts || drafts.length === 0) && (
        <EmptyState
          title="Nothing here yet"
          description="Start a draft — it's autosaved and stays private until you submit it."
          action={
            <Button onClick={() => startNewDraft()} disabled={isStarting}>
              Start writing
            </Button>
          }
        />
      )}

      <ul className="mt-6 space-y-2">
        {drafts?.map((draft) => (
          <li key={draft.id}>
            <Link
              to={`/drafts/${draft.id}/edit`}
              className="block rounded-md border border-border bg-surface p-4 hover:bg-muted"
            >
              <p className="font-medium">{draft.title || "Untitled"}</p>
              {/* Stripped, not rendered: marks inside a single clamped line
                  would be noise, and a truncated `**` would look like a typo. */}
              <p className="mt-1 line-clamp-1 text-sm text-muted-foreground">
                {(draft.contentFormat === "MARKDOWN" ? markdownToPlainText(draft.content) : draft.content) ||
                  "No content yet"}
              </p>
              <p className="mt-2 text-xs text-muted-foreground">{STATUS_LABELS[draft.status] ?? draft.status}</p>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
