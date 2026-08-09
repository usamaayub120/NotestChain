import { useState } from "react";
import { useAuditLog } from "@/hooks/useAdmin";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/EmptyState";
import { CardSkeletonList } from "@/components/CardSkeleton";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";

function humanizeAction(action: string): string {
  const words = action.replace(/_/g, " ").toLowerCase();
  return words.charAt(0).toUpperCase() + words.slice(1);
}

export function AuditLogPage() {
  const [page, setPage] = useState(1);
  const { data, isLoading } = useAuditLog(page);

  const totalPages = data ? Math.max(1, Math.ceil(data.meta.total / data.meta.pageSize)) : 1;

  return (
    <div className="mx-auto max-w-2xl px-4 py-6">
      <AdminPageHeader title="Audit log" description="Every moderation and admin action, newest first." />

      {isLoading && <div className="mt-6"><CardSkeletonList /></div>}
      {!isLoading && data?.data.length === 0 && (
        <EmptyState title="Nothing logged yet" description="Moderation and admin actions will show up here." />
      )}

      <ul className="mt-6 space-y-2">
        {data?.data.map((entry) => (
          <li key={entry.id} className="rounded-md border border-border bg-surface p-3 text-sm">
            <div className="flex items-center justify-between gap-3">
              <span className="font-medium">{humanizeAction(entry.action)}</span>
              <span className="text-xs text-muted-foreground">{new Date(entry.createdAt).toLocaleString()}</span>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              {entry.actor?.email ?? "system"}
              {entry.targetType && ` → ${entry.targetType} ${entry.targetId}`}
            </p>
            {entry.metadata && (
              <details className="mt-2">
                <summary className="min-h-11 cursor-pointer py-2 text-xs text-muted-foreground">
                  Technical details
                </summary>
                <pre className="mt-1 overflow-x-auto rounded bg-muted p-2 font-proof text-xs">
                  {JSON.stringify(entry.metadata, null, 2)}
                </pre>
              </details>
            )}
          </li>
        ))}
      </ul>

      {data && data.meta.total > data.meta.pageSize && (
        <div className="mt-6 flex items-center justify-between">
          <Button variant="outline" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
            Previous
          </Button>
          <span className="text-sm text-muted-foreground">
            Page {page} of {totalPages}
          </span>
          <Button variant="outline" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>
            Next
          </Button>
        </div>
      )}
    </div>
  );
}
