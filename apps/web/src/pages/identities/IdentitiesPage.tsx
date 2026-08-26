import { Link } from "react-router-dom";
import { useIdentities, useKeeperProfile, usePenNames } from "@/hooks/useIdentities";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/EmptyState";
import { SectionLoader } from "@/components/Loader";

export function IdentitiesPage() {
  const { isLoading } = useIdentities();
  const keeperProfile = useKeeperProfile();
  const penNames = usePenNames();

  return (
    <div className="mx-auto max-w-2xl px-4 py-6">
      <h1 className="text-2xl">Your bylines</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Every note or comment goes out under your Keeper profile or one of your pen names. Readers never see that a
        pen name belongs to the same account as any of your others.
      </p>

      {isLoading && <SectionLoader label="Loading your bylines" />}

      {keeperProfile && (
        <section className="mt-6">
          <h2 className="text-sm font-medium uppercase tracking-wide text-muted-foreground">Keeper profile</h2>
          <Link
            to={`/identities/${keeperProfile.id}/edit`}
            className="mt-2 flex items-center justify-between rounded-md border border-border bg-surface p-4 hover:border-primary"
          >
            <div>
              <p className="font-medium">
                {keeperProfile.displayName}{" "}
                <span className="font-normal text-muted-foreground">@{keeperProfile.username}</span>
              </p>
              <p className="text-xs text-muted-foreground">Your own profile — always visible and findable.</p>
            </div>
            <span className="text-sm text-muted-foreground">Edit →</span>
          </Link>
        </section>
      )}

      <section className="mt-6">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-medium uppercase tracking-wide text-muted-foreground">Pen names</h2>
          <Button asChild size="sm" variant="outline">
            <Link to="/identities/new">New pen name</Link>
          </Button>
        </div>

        {!isLoading && penNames && penNames.length === 0 && (
          <EmptyState
            title="No pen names yet"
            description="Create one to publish or comment under something other than your own name."
            action={
              <Button asChild>
                <Link to="/identities/new">Create a pen name</Link>
              </Button>
            }
          />
        )}

        <ul className="mt-2 space-y-2">
          {penNames?.map((identity) => (
            <li key={identity.id}>
              <Link
                to={`/identities/${identity.id}/edit`}
                className="flex items-center justify-between rounded-md border border-border bg-surface p-4 hover:border-primary"
              >
                <div>
                  <p className="font-medium">
                    {identity.displayName}{" "}
                    <span className="font-normal text-muted-foreground">@{identity.username}</span>
                  </p>
                  <p className="text-xs text-muted-foreground">{identity.isVisible ? "Visible" : "Hidden"}</p>
                </div>
                <span className="text-sm text-muted-foreground">Edit →</span>
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
