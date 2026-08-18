import { useSyncExternalStore, useState } from "react";
import { RefreshCw } from "lucide-react";
import { applyAppUpdate, getAppUpdateAvailable, subscribeToAppUpdate } from "@/lib/registerServiceWorker";
import { Button } from "@/components/ui/button";

export function AppUpdateBanner() {
  const available = useSyncExternalStore(subscribeToAppUpdate, getAppUpdateAvailable, () => false);
  const [updating, setUpdating] = useState(false);
  if (!available) return null;
  return <div className="fixed inset-x-3 bottom-24 z-50 mx-auto max-w-xl rounded-md border border-border bg-surface p-3 shadow-lg md:bottom-6" role="status"><div className="flex flex-wrap items-center justify-between gap-3"><p className="text-sm">A new version of NotesChain is ready.</p><Button size="sm" disabled={updating} onClick={() => { setUpdating(true); void applyAppUpdate(); }}>{updating ? "Updating…" : <><RefreshCw size={15} /> Update now</>}</Button></div></div>;
}
