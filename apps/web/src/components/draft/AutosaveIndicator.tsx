import { cn } from "@/lib/utils";

export type AutosaveState = "idle" | "unsaved" | "saving" | "saved" | "saved-too-long" | "offline" | "error";

const LABELS: Record<AutosaveState, string> = {
  idle: "",
  unsaved: "Unsaved changes",
  saving: "Saving…",
  saved: "Saved",
  // The state at the heart of the original complaint. A note over the limit
  // still saves — losing someone's words because they wrote too many would
  // be worse than the bug being fixed — but "Saved" on its own implied
  // "ready to submit", which is what let a writer keep going for a long time
  // before finding out otherwise.
  "saved-too-long": "Saved — too long to submit",
  offline: "Offline — we'll save when you're back",
  error: "Save failed — retrying",
};

export function AutosaveIndicator({ state }: { state: AutosaveState }) {
  if (state === "idle") return null;
  return (
    <span
      className={cn(
        "text-xs",
        state === "error" && "text-destructive",
        (state === "offline" || state === "saved-too-long") && "text-warning",
        (state === "saved" || state === "saving") && "text-muted-foreground",
        state === "unsaved" && "text-muted-foreground",
      )}
      role="status"
      aria-live="polite"
    >
      {LABELS[state]}
    </span>
  );
}
