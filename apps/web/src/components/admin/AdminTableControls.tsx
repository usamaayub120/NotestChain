import { Button } from "@/components/ui/button";

export const ADMIN_PAGE_SIZES = [10, 25, 50, 100] as const;
export type AdminDatePreset = "7" | "30" | "90" | "all" | "custom";

export interface AdminListState {
  page: number;
  pageSize: number;
  from?: string;
  to?: string;
}

export function AdminDateControls({
  preset,
  state,
  onPresetChange,
  onChange,
}: {
  preset: AdminDatePreset;
  state: AdminListState;
  onPresetChange: (preset: AdminDatePreset) => void;
  onChange: (next: Partial<AdminListState>) => void;
}) {
  return (
    <div className="flex flex-wrap items-end gap-2">
      <label className="grid gap-1 text-xs text-muted-foreground">
        Date range
        <select
          value={preset}
          onChange={(event) => onPresetChange(event.target.value as AdminDatePreset)}
          className="min-h-10 rounded-md border border-input bg-background px-2 text-sm text-foreground"
        >
          <option value="7">Last 7 days</option>
          <option value="30">Last 30 days</option>
          <option value="90">Last 90 days</option>
          <option value="all">All time</option>
          <option value="custom">Custom</option>
        </select>
      </label>
      {preset === "custom" && (
        <>
          <label className="grid gap-1 text-xs text-muted-foreground">
            From
            <input
              type="date"
              value={state.from ?? ""}
              onChange={(event) => onChange({ from: event.target.value || undefined, page: 1 })}
              className="min-h-10 rounded-md border border-input bg-background px-2 text-sm text-foreground"
            />
          </label>
          <label className="grid gap-1 text-xs text-muted-foreground">
            To
            <input
              type="date"
              value={state.to ?? ""}
              onChange={(event) => onChange({ to: event.target.value || undefined, page: 1 })}
              className="min-h-10 rounded-md border border-input bg-background px-2 text-sm text-foreground"
            />
          </label>
        </>
      )}
    </div>
  );
}

export function AdminPagination({ state, total, onChange }: { state: AdminListState; total: number; onChange: (next: Partial<AdminListState>) => void }) {
  const totalPages = Math.max(1, Math.ceil(total / state.pageSize));
  return (
    <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4 text-sm">
      <label className="flex items-center gap-2 text-muted-foreground">
        Rows
        <select
          value={state.pageSize}
          onChange={(event) => onChange({ pageSize: Number(event.target.value), page: 1 })}
          className="min-h-10 rounded-md border border-input bg-background px-2 text-foreground"
        >
          {ADMIN_PAGE_SIZES.map((size) => <option key={size} value={size}>{size}</option>)}
        </select>
      </label>
      <span className="text-muted-foreground">{total === 0 ? "No rows" : `${(state.page - 1) * state.pageSize + 1}–${Math.min(state.page * state.pageSize, total)} of ${total}`}</span>
      <div className="flex gap-2">
        <Button variant="outline" size="sm" disabled={state.page <= 1} onClick={() => onChange({ page: state.page - 1 })}>Previous</Button>
        <Button variant="outline" size="sm" disabled={state.page >= totalPages} onClick={() => onChange({ page: state.page + 1 })}>Next</Button>
      </div>
    </div>
  );
}

export function applyDatePreset(preset: AdminDatePreset): Pick<AdminListState, "from" | "to"> {
  if (preset === "all" || preset === "custom") return {};
  const days = Number(preset);
  const from = new Date();
  from.setDate(from.getDate() - days);
  return { from: from.toISOString().slice(0, 10), to: new Date().toISOString().slice(0, 10) };
}
