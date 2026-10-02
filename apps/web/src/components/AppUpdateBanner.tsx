import { useSyncExternalStore, useState } from "react";
import { RefreshCw, X } from "lucide-react";
import { applyAppUpdate, getAppUpdateAvailable, subscribeToAppUpdate } from "@/lib/registerServiceWorker";
import { Button } from "@/components/ui/button";

export function AppUpdateBanner() {
  const available = useSyncExternalStore(subscribeToAppUpdate, getAppUpdateAvailable, () => false);
  const [updating, setUpdating] = useState(false);
  // Was permanent for the session: once a service-worker update landed it
  // covered the bottom of every screen until the reader took the update.
  // Dismissing doesn't cancel the update, it just stops the banner nagging -
  // the new version still applies on the next natural reload.
  const [dismissed, setDismissed] = useState(false);

  if (!available || dismissed) return null;

  return (
    <div
      className="fixed inset-x-3 bottom-24 z-50 mx-auto max-w-xl rounded-md border border-border bg-surface p-3 shadow-lg md:bottom-6"
      role="status"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm">A new version of NotesChain is ready.</p>
        <div className="flex items-center gap-1">
          <Button
            size="sm"
            disabled={updating}
            aria-busy={updating}
            onClick={() => {
              setUpdating(true);
              void applyAppUpdate();
            }}
          >
            {updating ? (
              "Updating…"
            ) : (
              <>
                <RefreshCw size={15} aria-hidden /> Update now
              </>
            )}
          </Button>
          <button
            type="button"
            aria-label="Dismiss"
            onClick={() => setDismissed(true)}
            className="flex size-11 items-center justify-center rounded-md text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-surface md:hover:text-foreground"
          >
            <X size={16} strokeWidth={1.75} aria-hidden />
          </button>
        </div>
      </div>
    </div>
  );
}
