import { cn } from "@/lib/utils";
import type { Identity } from "@/hooks/useIdentities";

type IdentityMode = "NAMED" | "PSEUDONYMOUS" | "ANONYMOUS";

/**
 * The byline picker: every note is published under either the Keeper's own
 * profile or one of their pen names — there is no anonymous option here.
 * `identityMode` is derived from which identity is chosen (NAMED for the
 * Keeper profile, PSEUDONYMOUS for a pen name) rather than picked
 * separately, so the two can never disagree with each other.
 *
 * `onChange` still reports both values because DraftEditorPage persists
 * identityMode and publicIdentityId as sibling fields on the draft — see
 * checkIdentityConsistency in packages/validation/src/drafts.ts, which still
 * accepts ANONYMOUS on the wire for an already-installed mobile binary even
 * though nothing in this UI offers it anymore.
 */
export function IdentityModeSelector({
  identities,
  publicIdentityId,
  onChange,
}: {
  identities: Identity[];
  publicIdentityId: string | null;
  onChange: (mode: IdentityMode, publicIdentityId: string) => void;
}) {
  const keeperProfile = identities.find((identity) => identity.isPrimary);
  const penNames = identities.filter((identity) => !identity.isPrimary);

  function select(identity: Identity) {
    onChange(identity.isPrimary ? "NAMED" : "PSEUDONYMOUS", identity.id);
  }

  return (
    <fieldset>
      <legend className="text-sm font-medium">Publish as</legend>
      <div className="mt-2 space-y-2">
        {keeperProfile && (
          <BylineOption
            identity={keeperProfile}
            kind="Your Keeper profile"
            selected={publicIdentityId === keeperProfile.id}
            onSelect={() => select(keeperProfile)}
          />
        )}
        {penNames.map((identity) => (
          <BylineOption
            key={identity.id}
            identity={identity}
            kind="Pen name"
            selected={publicIdentityId === identity.id}
            onSelect={() => select(identity)}
          />
        ))}
      </div>
      {!keeperProfile && (
        <p className="mt-2 text-sm text-muted-foreground">Your Keeper profile is still loading — try again in a moment.</p>
      )}
      <p className="mt-2 text-sm text-muted-foreground">
        Want to publish under something other than your own name?{" "}
        <a href="/identities/new" className="text-primary underline">
          Create a pen name
        </a>
        .
      </p>
    </fieldset>
  );
}

function BylineOption({
  identity,
  kind,
  selected,
  onSelect,
}: {
  identity: Identity;
  kind: string;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      onClick={onSelect}
      className={cn(
        "flex w-full items-center gap-3 rounded-md border border-border px-3 py-2.5 text-left transition-colors",
        selected ? "border-primary bg-primary/10" : "bg-surface hover:bg-muted",
      )}
    >
      <span
        aria-hidden="true"
        className={cn(
          "flex h-4 w-4 shrink-0 items-center justify-center rounded-full border",
          selected ? "border-primary" : "border-muted-foreground",
        )}
      >
        {selected && <span className="h-2 w-2 rounded-full bg-primary" />}
      </span>
      <span className="min-w-0">
        <span className="block truncate text-sm font-medium text-foreground">
          {identity.displayName} <span className="font-normal text-muted-foreground">@{identity.username}</span>
        </span>
        <span className="block text-xs text-muted-foreground">{kind}</span>
      </span>
    </button>
  );
}
