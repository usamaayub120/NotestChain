import { AlertCircle, AlertTriangle, Check, CloudOff, Loader2, PenLine } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export type AutosaveState = "idle" | "unsaved" | "saving" | "saved" | "saved-too-long" | "offline" | "error";

const LABELS: Record<AutosaveState, string> = {
  idle: "",
  unsaved: "Unsaved changes",
  saving: "Saving…",
  saved: "Saved",
  // The state at the heart of the original complaint. A note over the limit
  // still saves -  losing someone's words because they wrote too many would
  // be worse than the bug being fixed -  but "Saved" on its own implied
  // "ready to submit", which is what let a writer keep going for a long time
  // before finding out otherwise.
  "saved-too-long": "Saved -  too long to submit",
  // Both of these used to describe a recovery that never happened: nothing
  // retried, so the words typed while offline were simply dropped. The editor
  // now holds the unsaved draft and sends it the moment the connection is
  // back, which is what makes this sentence true.
  offline: "Offline. We'll save when you're back.",
  error: "Couldn't save",
};

// §14: status never travels on colour alone. Each state carries an icon and a
// text label as well, so "saved" and "couldn't save" are distinguishable
// without seeing the difference between muted and destructive.
const ICONS: Record<Exclude<AutosaveState, "idle">, LucideIcon> = {
  unsaved: PenLine,
  saving: Loader2,
  saved: Check,
  "saved-too-long": AlertTriangle,
  offline: CloudOff,
  error: AlertCircle,
};

export function AutosaveIndicator({ state, onRetry }: { state: AutosaveState; onRetry?: () => void }) {
  if (state === "idle") return null;
  const Icon = ICONS[state];

  return (
    <span className="flex items-center gap-1.5">
      <span
        className={cn(
          "flex items-center gap-1 text-xs",
          state === "error" && "text-destructive",
          (state === "offline" || state === "saved-too-long") && "text-warning",
          state !== "error" && state !== "offline" && state !== "saved-too-long" && "text-muted-foreground",
        )}
        role="status"
        aria-live="polite"
      >
        <Icon
          size={14}
          strokeWidth={1.75}
          aria-hidden
          className={cn(state === "saving" && "motion-safe:animate-spin")}
        />
        {LABELS[state]}
      </span>
      {state === "error" && onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="min-h-11 rounded-md px-1 text-xs font-medium text-primary underline underline-offset-2 md:hover:text-primary/80"
        >
          Retry
        </button>
      )}
    </span>
  );
}
