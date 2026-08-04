import { cn } from "@/lib/utils";
import type { Identity } from "@/hooks/useIdentities";

type IdentityMode = "NAMED" | "PSEUDONYMOUS" | "ANONYMOUS";

const MODES: { value: IdentityMode; label: string; hint: string }[] = [
  { value: "NAMED", label: "Your name", hint: "Published under a real-name identity" },
  { value: "PSEUDONYMOUS", label: "Pseudonym", hint: "Published under one of your pseudonyms" },
  { value: "ANONYMOUS", label: "Anonymous", hint: "Shown as “Anonymous” to everyone" },
];

export function IdentityModeSelector({
  value,
  identities,
  publicIdentityId,
  onChange,
}: {
  value: IdentityMode;
  identities: Identity[];
  publicIdentityId: string | null;
  onChange: (mode: IdentityMode, publicIdentityId: string | null) => void;
}) {
  const relevantIdentities = identities.filter((i) =>
    value === "NAMED" ? i.type === "REAL_NAME" : value === "PSEUDONYMOUS" ? i.type === "PSEUDONYM" : false,
  );

  return (
    <fieldset>
      <legend className="text-sm font-medium">Publish as</legend>
      <div className="mt-2 grid grid-cols-3 gap-2">
        {MODES.map((mode) => (
          <button
            key={mode.value}
            type="button"
            aria-pressed={value === mode.value}
            onClick={() => onChange(mode.value, null)}
            className={cn(
              "rounded-md border border-border px-3 py-2 text-sm font-medium transition-colors",
              value === mode.value ? "border-primary bg-primary/10 text-primary" : "bg-surface text-foreground",
            )}
          >
            {mode.label}
          </button>
        ))}
      </div>

      {(value === "NAMED" || value === "PSEUDONYMOUS") && (
        <div className="mt-3">
          {relevantIdentities.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              You don't have a {value === "NAMED" ? "real-name identity" : "pseudonym"} yet — create one on the{" "}
              <a href="/identities/new" className="text-primary underline">
                Identities
              </a>{" "}
              page first.
            </p>
          ) : (
            <select
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-base"
              value={publicIdentityId ?? ""}
              onChange={(e) => onChange(value, e.target.value || null)}
            >
              <option value="" disabled>
                Choose an identity
              </option>
              {relevantIdentities.map((identity) => (
                <option key={identity.id} value={identity.id}>
                  {identity.displayName} (@{identity.username})
                </option>
              ))}
            </select>
          )}
        </div>
      )}
    </fieldset>
  );
}
