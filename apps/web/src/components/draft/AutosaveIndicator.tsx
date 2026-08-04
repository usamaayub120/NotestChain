import { cn } from "@/lib/utils";

export type AutosaveState = "idle" | "unsaved" | "saving" | "saved" | "offline" | "error";

const LABELS: Record<AutosaveState, string> = {
  idle: "",
  unsaved: "Unsaved changes",
  saving: "Saving…",
  saved: "Saved",
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
        state === "offline" && "text-warning",
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
