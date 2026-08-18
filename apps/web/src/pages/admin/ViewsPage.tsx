import { useState } from "react";
import { Link } from "react-router-dom";
import { useViewsBreakdown } from "@/hooks/useAdmin";
import { EmptyState } from "@/components/EmptyState";
import { CardSkeletonList } from "@/components/CardSkeleton";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { AdminDateControls, AdminPagination, applyDatePreset, type AdminDatePreset, type AdminListState } from "@/components/admin/AdminTableControls";

export function ViewsPage() {
  const [preset, setPreset] = useState<AdminDatePreset>("30");
  const [state, setState] = useState<AdminListState>({ page: 1, pageSize: 25, ...applyDatePreset("30") });
  const { data, isLoading } = useViewsBreakdown(state);
  const onChange = (next: Partial<AdminListState>) => setState((current) => ({ ...current, ...next }));
  const onPreset = (next: AdminDatePreset) => { setPreset(next); setState((current) => ({ ...current, ...applyDatePreset(next), page: 1 })); };

  return (
    <div className="px-4 py-6 md:px-8">
      <AdminPageHeader title="Unique readers" description={`Readers are counted once per browser per note. ${data?.total ?? "…"} unique readers in the selected period.`} />
      <div className="mt-5"><AdminDateControls preset={preset} state={state} onPresetChange={onPreset} onChange={onChange} /></div>
      {isLoading && <div className="mt-6"><CardSkeletonList /></div>}
      {!isLoading && data?.total === 0 && <EmptyState title="No unique readers yet" description="New unique-reader analytics begin after this feature is deployed." />}
      {data && data.total > 0 && <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1fr)_20rem]">
        <section className="min-w-0">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Most read notes</h2>
          <div className="mt-3 overflow-x-auto rounded-md border border-border bg-surface"><table className="w-full min-w-[34rem] text-sm"><thead className="border-b border-border bg-muted/50 text-left text-xs uppercase tracking-wide text-muted-foreground"><tr><th className="w-14 px-4 py-3">#</th><th className="px-4 py-3">Note</th><th className="px-4 py-3 text-right">Unique readers</th></tr></thead><tbody>{data.mostViewed.items.map((row, index) => <tr key={row.publication?.id ?? index} className="border-b border-border last:border-0"><td className="px-4 py-3 text-muted-foreground">{(state.page - 1) * state.pageSize + index + 1}</td><td className="px-4 py-3">{row.publication ? <Link to={`/p/${row.publication.id}`} className="font-medium text-primary underline">{row.publication.title}</Link> : <span className="text-muted-foreground">(deleted)</span>}</td><td className="px-4 py-3 text-right font-medium">{row.uniqueReaders}</td></tr>)}</tbody></table></div>
          <AdminPagination state={state} total={data.mostViewed.total} onChange={onChange} />
        </section>
        <section><h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">First source</h2><div className="mt-3 overflow-hidden rounded-md border border-border bg-surface"><table className="w-full text-sm"><tbody>{data.bySource.map((row) => <tr key={row.utmSource} className="border-b border-border last:border-0"><td className="px-4 py-3">{row.utmSource}</td><td className="px-4 py-3 text-right font-medium">{row.count}</td></tr>)}</tbody></table></div></section>
      </div>}
    </div>
  );
}
