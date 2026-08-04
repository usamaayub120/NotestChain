import { Link } from "react-router-dom";
import { useCurrentUser, useLogout } from "@/hooks/useAuth";
import { useStartNewDraft } from "@/hooks/useStartNewDraft";
import { Button } from "@/components/ui/button";

export function DashboardPage() {
  const { data: user } = useCurrentUser();
  const logout = useLogout();
  const { start: startNewDraft, isPending: isStarting } = useStartNewDraft();

  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <h1 className="text-2xl">Dashboard</h1>
      <p className="mt-1 text-muted-foreground">Signed in as {user?.email}</p>

      <div className="mt-8 grid gap-4 sm:grid-cols-2">
        <button
          type="button"
          onClick={() => startNewDraft()}
          disabled={isStarting}
          className="rounded-md border border-border bg-surface p-4 text-left hover:bg-muted"
        >
          <h2 className="text-lg">Start a new draft</h2>
          <p className="mt-1 text-sm text-muted-foreground">Autosaved as you write.</p>
        </button>
        <Link to="/drafts" className="rounded-md border border-border bg-surface p-4 hover:bg-muted">
          <h2 className="text-lg">Your drafts</h2>
          <p className="mt-1 text-sm text-muted-foreground">Pick up where you left off.</p>
        </Link>
        <Link to="/identities" className="rounded-md border border-border bg-surface p-4 hover:bg-muted">
          <h2 className="text-lg">Identities</h2>
          <p className="mt-1 text-sm text-muted-foreground">Manage your name and pseudonyms.</p>
        </Link>
        <Link to="/bookmarks" className="rounded-md border border-border bg-surface p-4 hover:bg-muted">
          <h2 className="text-lg">Saved</h2>
          <p className="mt-1 text-sm text-muted-foreground">Publications you've bookmarked.</p>
        </Link>
        {user && (user.role === "MODERATOR" || user.role === "ADMIN") && (
          <Link to="/admin" className="rounded-md border border-border bg-surface p-4 hover:bg-muted">
            <h2 className="text-lg">Admin</h2>
            <p className="mt-1 text-sm text-muted-foreground">Moderation, reports, blockchain jobs.</p>
          </Link>
        )}
      </div>

      <Button variant="outline" className="mt-8" onClick={() => logout.mutate()}>
        Sign out
      </Button>
    </div>
  );
}
