import { useState } from "react";
import { Link } from "react-router-dom";
import { usePendingSubmissions } from "@/hooks/useModeration";
import { EmptyState } from "@/components/EmptyState";
import { CardSkeletonList } from "@/components/CardSkeleton";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { AdminDateControls, AdminPagination, applyDatePreset, type AdminDatePreset, type AdminListState } from "@/components/admin/AdminTableControls";
import { markdownToPlainText } from "@noteschain/shared";

export function ModerationQueuePage() {
  const [preset, setPreset] = useState<AdminDatePreset>("all");
  const [state, setState] = useState<AdminListState>({ page: 1, pageSize: 25 });
  const { data, isLoading } = usePendingSubmissions(state.page, state.pageSize, state.from, state.to);
  const onChange = (next: Partial<AdminListState>) => setState((current) => ({ ...current, ...next }));
  const onPreset = (next: AdminDatePreset) => { setPreset(next); setState((current) => ({ ...current, ...applyDatePreset(next), page: 1 })); };
  return <div className="px-4 py-6 md:px-8"><AdminPageHeader title="Moderation queue" description="Pending submissions, oldest first." /><div className="mt-5"><AdminDateControls preset={preset} state={state} onPresetChange={onPreset} onChange={onChange} /></div>{isLoading && <div className="mt-6"><CardSkeletonList /></div>}{!isLoading && data?.data.length === 0 && <EmptyState title="Nothing pending" description="The queue is empty right now." />}{data && data.data.length > 0 && <><div className="mt-6 overflow-x-auto rounded-md border border-border bg-surface"><table className="w-full min-w-[48rem] text-sm"><thead className="border-b border-border bg-muted/50 text-left text-xs uppercase tracking-wide text-muted-foreground"><tr><th className="w-14 px-4 py-3">#</th><th className="px-4 py-3">Submission</th><th className="px-4 py-3">Author</th><th className="px-4 py-3">Submitted</th><th className="px-4 py-3"></th></tr></thead><tbody>{data.data.map((submission, index) => <tr key={submission.id} className="border-b border-border last:border-0"><td className="px-4 py-3 text-muted-foreground">{(state.page - 1) * state.pageSize + index + 1}</td><td className="px-4 py-3"><p className="font-medium">{submission.titleSnapshot}</p><p className="mt-1 max-w-xl truncate text-xs text-muted-foreground">{submission.contentFormatSnapshot === "MARKDOWN" ? markdownToPlainText(submission.contentSnapshot) : submission.contentSnapshot}</p></td><td className="px-4 py-3 text-muted-foreground">{submission.submittedBy.email}</td><td className="px-4 py-3 text-muted-foreground">{new Date(submission.createdAt).toLocaleString()}</td><td className="px-4 py-3 text-right"><Link className="text-primary underline" to={`/admin/submissions/${submission.id}`}>Review</Link></td></tr>)}</tbody></table></div><AdminPagination state={state} total={data.meta.total} onChange={onChange} /></>}</div>;
}
