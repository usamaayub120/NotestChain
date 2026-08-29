import { useState } from "react";
import { Link } from "react-router-dom";
import { PenSquare, Trash2 } from "lucide-react";
import { useDeleteDraft, useDrafts } from "@/hooks/useDrafts";
import { useStartNewDraft } from "@/hooks/useStartNewDraft";
import { EmptyState } from "@/components/EmptyState";
import { CardSkeletonList } from "@/components/CardSkeleton";
import { ConfirmActionDialog } from "@/components/ConfirmActionDialog";
import { Button } from "@/components/ui/button";
import { markdownToPlainText } from "@noteschain/shared";

const STATUS_LABELS: Record<string, string> = {
  DRAFT: "Draft",
  PENDING_REVIEW: "Awaiting review",
  CHANGES_REQUESTED: "Changes requested",
  REJECTED: "Rejected",
  APPROVED: "Approved -  ready to publish",
  CHAIN_PENDING: "Publishing…",
  CHAIN_SUBMITTED: "Publishing…",
  PUBLISHED: "Published",
  CHAIN_FAILED: "Publishing failed",
  ARCHIVED: "Archived",
};

export function DraftsListPage() {
  const { data: drafts, isLoading } = useDrafts();
  const { start: startNewDraft, isPending: isStarting } = useStartNewDraft();
  const deleteDraft = useDeleteDraft();
  const [draftPendingDelete, setDraftPendingDelete] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const draftToDelete = drafts?.find((draft) => draft.id === draftPendingDelete);

  function confirmDelete() {
    if (!draftToDelete) return;
    setDeleteError(null);
    deleteDraft.mutate(draftToDelete.id, {
      onSuccess: () => setDraftPendingDelete(null),
      onError: () => setDeleteError("Could not delete that draft. Please try again."),
    });
  }

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
          description="Start a draft -  it's autosaved and stays private until you submit it."
          action={
            <Button onClick={() => startNewDraft()} disabled={isStarting}>
              Start writing
            </Button>
          }
        />
      )}

      {deleteError && <p role="alert" className="mt-4 text-sm text-destructive">{deleteError}</p>}

      <ul className="mt-6 space-y-2">
        {drafts?.map((draft) => (
          <li key={draft.id}>
            <div className="flex items-center gap-2 rounded-md border border-border bg-surface p-4 hover:bg-muted">
              <Link to={`/drafts/${draft.id}/edit`} className="min-w-0 flex-1">
                <p className="font-medium">{draft.title || "Untitled"}</p>
                {/* Stripped, not rendered: marks inside a single clamped line
                    would be noise, and a truncated `**` would look like a typo. */}
                <p className="mt-1 line-clamp-1 text-sm text-muted-foreground">
                  {(draft.contentFormat === "MARKDOWN" ? markdownToPlainText(draft.content) : draft.content) ||
                    "No content yet"}
                </p>
                <p className="mt-2 text-xs text-muted-foreground">{STATUS_LABELS[draft.status] ?? draft.status}</p>
              </Link>
              {(draft.status === "DRAFT" || draft.status === "CHANGES_REQUESTED") && (
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label={`Delete ${draft.title || "untitled draft"}`}
                  onClick={() => setDraftPendingDelete(draft.id)}
                >
                  <Trash2 size={18} aria-hidden="true" />
                </Button>
              )}
            </div>
          </li>
        ))}
      </ul>

      <ConfirmActionDialog
        open={Boolean(draftToDelete)}
        onOpenChange={(open) => {
          if (!open) setDraftPendingDelete(null);
        }}
        isPending={deleteDraft.isPending}
        onConfirm={confirmDelete}
        title="Delete this draft?"
        description={`“${draftToDelete?.title || "Untitled draft"}” will be permanently deleted.`}
        confirmLabel="Delete"
        pendingLabel="Deleting…"
      />
    </div>
  );
}
