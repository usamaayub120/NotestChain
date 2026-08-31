import { useState } from "react";
import { UserCheck, UserRound, UserRoundX, UsersRound } from "lucide-react";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { AdminPagination, type AdminListState } from "@/components/admin/AdminTableControls";
import { CardSkeletonList } from "@/components/CardSkeleton";
import { EmptyState } from "@/components/EmptyState";
import { MutationError } from "@/components/admin/MutationError";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useAdminUsers, useUpdateUserStatus, useUserStats, type AdminUser } from "@/hooks/useAdmin";

const statusLabels: Record<AdminUser["status"], string> = {
  ACTIVE: "Active",
  SUSPENDED: "Suspended",
  DELETED: "Deleted",
};

function formatDate(value: string | null) {
  return value ? new Date(value).toLocaleString() : "No authenticated activity";
}

function Metric({ label, value, detail, icon: Icon }: { label: string; value: number | undefined; detail: string; icon: typeof UsersRound }) {
  return (
    <div className="border-b border-border py-4 sm:border-b-0 sm:border-r sm:px-4 sm:last:border-r-0">
      <div className="flex items-center justify-between gap-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {label}<Icon size={16} aria-hidden="true" />
      </div>
      <p className="mt-2 text-2xl font-semibold tabular-nums">{value ?? "—"}</p>
      <p className="mt-1 text-xs text-muted-foreground">{detail}</p>
    </div>
  );
}

function UserStatusAction({ user }: { user: AdminUser }) {
  const updateStatus = useUpdateUserStatus();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const targetStatus = user.status === "ACTIVE" ? "SUSPENDED" : "ACTIVE";
  const isSuspending = targetStatus === "SUSPENDED";
  const actionAvailable = user.role !== "ADMIN" && user.status !== "DELETED";

  if (!actionAvailable) return <span className="text-xs text-muted-foreground">—</span>;

  const submit = () => updateStatus.mutate(
    { id: user.id, status: targetStatus, reason },
    { onSuccess: () => { setReason(""); setOpen(false); } },
  );

  return (
    <>
      <Button size="sm" variant={isSuspending ? "destructive" : "outline"} onClick={() => setOpen(true)}>
        {isSuspending ? "Suspend" : "Reinstate"}
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{isSuspending ? "Suspend this account?" : "Reinstate this account?"}</DialogTitle>
            <DialogDescription>
              {isSuspending
                ? "The user will be signed out on every device and will not be able to authenticate."
                : "The user will be allowed to sign in again. Existing sessions stay revoked."}
            </DialogDescription>
          </DialogHeader>
          <label className="grid gap-2 text-sm font-medium">
            Internal reason
            <textarea
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              maxLength={500}
              placeholder={isSuspending ? "Why is this account being suspended?" : "Why is this account being reinstated?"}
              className="min-h-24 rounded-md border border-input bg-background p-3 text-sm font-normal"
            />
          </label>
          <MutationError error={updateStatus.error} />
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)} disabled={updateStatus.isPending}>Cancel</Button>
            <Button variant={isSuspending ? "destructive" : "default"} onClick={submit} disabled={reason.trim().length === 0 || updateStatus.isPending}>
              {updateStatus.isPending ? "Saving…" : isSuspending ? "Suspend account" : "Reinstate account"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

export function UsersPage() {
  const [state, setState] = useState<AdminListState>({ page: 1, pageSize: 25 });
  const [status, setStatus] = useState<AdminUser["status"] | "ALL">("ALL");
  const [search, setSearch] = useState("");
  const stats = useUserStats();
  const users = useAdminUsers({ page: state.page, pageSize: state.pageSize, status: status === "ALL" ? undefined : status, search });
  const onChange = (next: Partial<AdminListState>) => setState((current) => ({ ...current, ...next }));

  return (
    <div className="px-4 py-6 md:px-8">
      <AdminPageHeader title="Users" description="Account growth, recent authenticated activity, contributions, and access status." />

      <section className="mt-6 grid divide-border rounded-md border border-border bg-surface sm:grid-cols-2 xl:grid-cols-4" aria-label="User statistics">
        <Metric label="All accounts" value={stats.data?.total} detail={`${stats.data?.newLast30Days ?? 0} registered in 30 days`} icon={UsersRound} />
        <Metric label="Active accounts" value={stats.data?.active} detail={`${stats.data?.suspended ?? 0} currently suspended`} icon={UserCheck} />
        <Metric label="Active in 7 days" value={stats.data?.activeLast7Days} detail={`${stats.data?.activeLast30Days ?? 0} active in 30 days`} icon={UserRound} />
        <Metric label="Contributions" value={stats.data?.publishedNotes} detail={`${stats.data?.comments ?? 0} comments posted`} icon={UserRoundX} />
      </section>
      {stats.data && stats.data.deleted > 0 && <p className="mt-2 text-xs text-muted-foreground">{stats.data.deleted} deleted account{stats.data.deleted === 1 ? "" : "s"} retained as permanence-aware records.</p>}

      <div className="mt-7 flex flex-wrap items-end gap-3">
        <label className="grid gap-1 text-xs text-muted-foreground">
          Account status
          <select value={status} onChange={(event) => { setStatus(event.target.value as typeof status); setState((current) => ({ ...current, page: 1 })); }} className="min-h-10 rounded-md border border-input bg-background px-2 text-sm text-foreground">
            <option value="ALL">All statuses</option>
            <option value="ACTIVE">Active</option>
            <option value="SUSPENDED">Suspended</option>
            <option value="DELETED">Deleted</option>
          </select>
        </label>
        <label className="grid min-w-[15rem] flex-1 gap-1 text-xs text-muted-foreground sm:max-w-md">
          Find a user
          <input value={search} onChange={(event) => { setSearch(event.target.value); setState((current) => ({ ...current, page: 1 })); }} placeholder="Email, username, or display name" className="min-h-10 rounded-md border border-input bg-background px-3 text-sm text-foreground" />
        </label>
      </div>

      {users.isLoading && <div className="mt-6"><CardSkeletonList /></div>}
      {!users.isLoading && users.data?.data.length === 0 && <div className="mt-6"><EmptyState title="No matching users" description="Try clearing the search or choosing another account status." /></div>}
      {users.data && users.data.data.length > 0 && <>
        <div className="mt-6 overflow-x-auto rounded-md border border-border bg-surface">
          <table className="w-full min-w-[75rem] text-sm">
            <thead className="border-b border-border bg-muted/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
              <tr><th className="px-4 py-3">User</th><th className="px-4 py-3">Status</th><th className="px-4 py-3">Registered</th><th className="px-4 py-3">Last active</th><th className="px-4 py-3">Contributions</th><th className="px-4 py-3">Sessions</th><th className="px-4 py-3 text-right">Action</th></tr>
            </thead>
            <tbody>
              {users.data.data.map((user) => <tr key={user.id} className="border-b border-border last:border-0 align-top">
                <td className="px-4 py-3"><p className="font-medium">{user.primaryIdentity?.displayName ?? "No public profile"}</p><p className="mt-1 text-xs text-muted-foreground">{user.email}</p>{user.primaryIdentity && <p className="mt-1 text-xs text-muted-foreground">@{user.primaryIdentity.username} · {user.role.toLowerCase()}</p>}</td>
                <td className="px-4 py-3"><span className={user.status === "ACTIVE" ? "rounded-full bg-success/15 px-2 py-1 text-xs font-medium text-success" : user.status === "SUSPENDED" ? "rounded-full bg-destructive/15 px-2 py-1 text-xs font-medium text-destructive" : "rounded-full bg-muted px-2 py-1 text-xs font-medium text-muted-foreground"}>{statusLabels[user.status]}</span></td>
                <td className="whitespace-nowrap px-4 py-3 text-muted-foreground">{formatDate(user.createdAt)}</td>
                <td className="whitespace-nowrap px-4 py-3 text-muted-foreground">{formatDate(user.lastActiveAt)}</td>
                <td className="px-4 py-3 text-muted-foreground">{user.publishedNotes} note{user.publishedNotes === 1 ? "" : "s"} · {user.comments} comment{user.comments === 1 ? "" : "s"}</td>
                <td className="px-4 py-3 text-muted-foreground">{user.activeSessions} active</td>
                <td className="px-4 py-3 text-right"><UserStatusAction user={user} /></td>
              </tr>)}
            </tbody>
          </table>
        </div>
        <AdminPagination state={state} total={users.data.meta.total} onChange={onChange} />
      </>}
    </div>
  );
}
