import { cn } from "@/lib/utils";

type Discoverability = "PUBLIC" | "UNLISTED";

export function DiscoverabilitySelector({
  value,
  onChange,
}: {
  value: Discoverability;
  onChange: (value: Discoverability) => void;
}) {
  return (
    <fieldset>
      <legend className="text-sm font-medium">Discoverability</legend>
      <div className="mt-2 grid grid-cols-2 gap-2">
        <button
          type="button"
          aria-pressed={value === "PUBLIC"}
          onClick={() => onChange("PUBLIC")}
          className={cn(
            "rounded-md border border-border px-3 py-2 text-left text-sm transition-colors",
            value === "PUBLIC" ? "border-primary bg-primary/10" : "bg-surface",
          )}
        >
          <span className="font-medium">Public</span>
          <span className="block text-xs text-muted-foreground">Shown in search and Explore</span>
        </button>
        <button
          type="button"
          aria-pressed={value === "UNLISTED"}
          onClick={() => onChange("UNLISTED")}
          className={cn(
            "rounded-md border border-border px-3 py-2 text-left text-sm transition-colors",
            value === "UNLISTED" ? "border-primary bg-primary/10" : "bg-surface",
          )}
        >
          <span className="font-medium">Unlisted</span>
          <span className="block text-xs text-muted-foreground">Only reachable by direct link</span>
        </button>
      </div>
      {value === "UNLISTED" && (
        <p className="mt-2 text-xs text-muted-foreground">
          Unlisted isn't private — it's still stored on Solana and reachable by anyone with the link.
        </p>
      )}
    </fieldset>
  );
}
