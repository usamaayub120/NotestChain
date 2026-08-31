import { Link } from "react-router-dom";
import { useCurrentUser, useLogout } from "@/hooks/useAuth";
import { useStartNewDraft } from "@/hooks/useStartNewDraft";
import { useKeeperProfile } from "@/hooks/useIdentities";
import { Button } from "@/components/ui/button";
import { Permission, hasPermission } from "@noteschain/shared";

export function DashboardPage() {
  const { data: user } = useCurrentUser();
  const logout = useLogout();
  const { start: startNewDraft, isPending: isStarting } = useStartNewDraft();
  const keeperProfile = useKeeperProfile();

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 md:px-8 lg:py-12">
      <h1 className="text-2xl md:text-3xl">Dashboard</h1>
      <p className="mt-1 text-muted-foreground">Signed in as {user?.email}</p>
      <p className="mt-4 text-sm italic text-muted-foreground">Some days it's one sentence. That's still a keep.</p>

      <div className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
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
        <Link to="/published-notes" className="rounded-md border border-border bg-surface p-4 hover:bg-muted">
          <h2 className="text-lg">Published notes</h2>
          <p className="mt-1 text-sm text-muted-foreground">See unique readers for every note you have published.</p>
        </Link>
        <Link to="/identities" className="rounded-md border border-border bg-surface p-4 hover:bg-muted">
          <h2 className="text-lg">Your bylines</h2>
          <p className="mt-1 text-sm text-muted-foreground">Manage your Keeper profile and pen names.</p>
        </Link>
        <Link to="/bookmarks" className="rounded-md border border-border bg-surface p-4 hover:bg-muted">
          <h2 className="text-lg">Saved</h2>
          <p className="mt-1 text-sm text-muted-foreground">Publications you've bookmarked.</p>
        </Link>
        <Link to="/how-it-works" className="rounded-md border border-border bg-surface p-4 hover:bg-muted">
          <h2 className="text-lg">How it works</h2>
          <p className="mt-1 text-sm text-muted-foreground">What happens between writing and keeping.</p>
        </Link>
        <Link to="/verify" className="rounded-md border border-border bg-surface p-4 hover:bg-muted">
          <h2 className="text-lg">Verify a note</h2>
          <p className="mt-1 text-sm text-muted-foreground">Check any note's URL, signature, or address against the chain.</p>
        </Link>
        {keeperProfile && (
          <Link to={`/@${keeperProfile.username}`} className="rounded-md border border-border bg-surface p-4 hover:bg-muted">
            <h2 className="text-lg">Your Keeper profile</h2>
            <p className="mt-1 text-sm text-muted-foreground">@{keeperProfile.username} -  what readers see.</p>
          </Link>
        )}
        {user?.roles.length ? (
          <Link to={hasPermission(user.roles, Permission.CREATE_CAMPAIGN) || hasPermission(user.roles, Permission.APPROVE_CAMPAIGN) ? "/admin/campaigns" : "/admin"} className="rounded-md border border-border bg-surface p-4 hover:bg-muted">
            <h2 className="text-lg">Staff access</h2>
            <p className="mt-1 text-sm text-muted-foreground">Open the tools available to your assigned staff role.</p>
          </Link>
        ) : null}
      </div>

      <Button variant="outline" className="mt-8" onClick={() => logout.mutate()}>
        Sign out
      </Button>
    </div>
  );
}
