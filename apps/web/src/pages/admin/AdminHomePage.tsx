import { Link } from "react-router-dom";

export function AdminHomePage() {
  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <h1 className="text-2xl">Admin</h1>

      <div className="mt-8 grid gap-4 sm:grid-cols-2">
        <Link to="/admin/submissions" className="rounded-md border border-border bg-surface p-4 hover:bg-muted">
          <h2 className="text-lg">Moderation queue</h2>
          <p className="mt-1 text-sm text-muted-foreground">Review pending submissions.</p>
        </Link>
        <Link to="/admin/reports" className="rounded-md border border-border bg-surface p-4 hover:bg-muted">
          <h2 className="text-lg">Reports</h2>
          <p className="mt-1 text-sm text-muted-foreground">Reader reports awaiting resolution.</p>
        </Link>
        <Link to="/admin/blockchain" className="rounded-md border border-border bg-surface p-4 hover:bg-muted">
          <h2 className="text-lg">Blockchain jobs</h2>
          <p className="mt-1 text-sm text-muted-foreground">Publish job queue, retries, reconciliation.</p>
        </Link>
        <Link to="/admin/audit-log" className="rounded-md border border-border bg-surface p-4 hover:bg-muted">
          <h2 className="text-lg">Audit log</h2>
          <p className="mt-1 text-sm text-muted-foreground">Every moderation/admin action taken.</p>
        </Link>
      </div>
    </div>
  );
}
