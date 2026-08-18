import { useState } from "react";
import { Link } from "react-router-dom";
import { EmptyState } from "@/components/EmptyState";
import { CardSkeletonList } from "@/components/CardSkeleton";
import { AdminPagination, type AdminListState } from "@/components/admin/AdminTableControls";
import { useMyPublicationAnalytics } from "@/hooks/usePublicationAnalytics";

export function PublishedNotesPage() {
  const [state, setState] = useState<AdminListState>({ page: 1, pageSize: 25 });
  const { data, isLoading } = useMyPublicationAnalytics(state.page, state.pageSize);
  const onChange = (next: Partial<AdminListState>) => setState((current) => ({ ...current, ...next }));

  return (
    <div className="mx-auto max-w-5xl px-4 py-6 md:px-8">
      <h1 className="text-2xl">Published notes</h1>
      <p className="mt-1 text-sm text-muted-foreground">Unique readers are counted once per browser for each note. Analytics begin from the unique-reader launch.</p>
      {isLoading && <div className="mt-6"><CardSkeletonList /></div>}
      {!isLoading && data?.data.length === 0 && <EmptyState title="No published notes yet" description="Your published notes and their reader totals will appear here." />}
      {data && data.data.length > 0 && (
        <>
          <div className="mt-6 overflow-x-auto rounded-md border border-border bg-surface">
            <table className="w-full min-w-[38rem] text-sm">
              <thead className="border-b border-border bg-muted/50 text-left text-xs uppercase tracking-wide text-muted-foreground"><tr><th className="w-14 px-4 py-3">#</th><th className="px-4 py-3">Note</th><th className="px-4 py-3">Published</th><th className="px-4 py-3 text-right">Unique readers</th></tr></thead>
              <tbody>{data.data.map((note, index) => <tr key={note.id} className="border-b border-border last:border-0"><td className="px-4 py-3 text-muted-foreground">{(state.page - 1) * state.pageSize + index + 1}</td><td className="px-4 py-3"><Link className="font-medium text-primary underline" to={`/p/${note.id}`}>{note.title}</Link></td><td className="px-4 py-3 text-muted-foreground">{new Date(note.publishedAt ?? note.createdAt).toLocaleDateString()}</td><td className="px-4 py-3 text-right font-medium">{note.uniqueReaders}</td></tr>)}</tbody>
            </table>
          </div>
          <AdminPagination state={state} total={data.meta.total} onChange={onChange} />
        </>
      )}
    </div>
  );
}
