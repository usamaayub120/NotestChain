import { Link } from "react-router-dom";
import { type Identity, useIdentities, useUpdateIdentity } from "@/hooks/useIdentities";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/EmptyState";
import { SectionLoader } from "@/components/Loader";

export function IdentitiesPage() {
  const { data: identities, isLoading } = useIdentities();

  return (
    <div className="mx-auto max-w-2xl px-4 py-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl">Identities</h1>
        <Button asChild size="sm">
          <Link to="/identities/new">New identity</Link>
        </Button>
      </div>
      <p className="mt-1 text-sm text-muted-foreground">
        Your real name and any pseudonyms. Readers never see that two pseudonyms belong to the same account.
      </p>

      {isLoading && <SectionLoader label="Loading your identities" />}

      {!isLoading && (!identities || identities.length === 0) && (
        <EmptyState
          title="No identities yet"
          description="Create a real-name or pseudonym identity before publishing under a name."
          action={
            <Button asChild>
              <Link to="/identities/new">Create your first identity</Link>
            </Button>
          }
        />
      )}

      <ul className="mt-6 space-y-2">
        {identities?.map((identity) => (
          <IdentityRow key={identity.id} identity={identity} />
        ))}
      </ul>
    </div>
  );
}

function IdentityRow({ identity }: { identity: Identity }) {
  const update = useUpdateIdentity(identity.id);
  return (
    <li className="flex items-center justify-between rounded-md border border-border bg-surface p-4">
      <div>
        <p className="font-medium">
          {identity.displayName}{" "}
          <span className="font-normal text-muted-foreground">@{identity.username}</span>
        </p>
        <p className="text-xs text-muted-foreground">{identity.type === "REAL_NAME" ? "Real name" : "Pseudonym"}</p>
      </div>
      <Button
        variant="outline"
        size="sm"
        onClick={() => update.mutate({ isVisible: !identity.isVisible })}
        disabled={update.isPending}
      >
        {identity.isVisible ? "Visible" : "Hidden"}
      </Button>
    </li>
  );
}
