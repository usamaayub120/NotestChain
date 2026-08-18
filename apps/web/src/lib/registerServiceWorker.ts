import { registerSW } from "virtual:pwa-register";

const UPDATE_CHECK_INTERVAL_MS = 60 * 60 * 1000;
let updateAvailable = false;
let updateWorker: ((reloadPage?: boolean) => Promise<void>) | undefined;
const listeners = new Set<() => void>();

function notify() { listeners.forEach((listener) => listener()); }

export function subscribeToAppUpdate(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getAppUpdateAvailable() { return updateAvailable; }

export async function applyAppUpdate() {
  // Only purge NotesChain-managed Cache Storage entries. Browser HTTP cache
  // and other sites' storage remain untouched, while stale API responses
  // cannot survive the deliberate application update.
  if ("caches" in window) {
    const names = await caches.keys();
    await Promise.all(names.filter((name) => name.includes("workbox") || name.includes("public-api-cache")).map((name) => caches.delete(name)));
  }
  await updateWorker?.(true);
}

export function registerServiceWorker() {
  if (!("serviceWorker" in navigator)) return;
  updateWorker = registerSW({
    immediate: true,
    onRegisteredSW(_url, registration) {
      if (!registration) return;
      setInterval(() => registration.update().catch(() => {}), UPDATE_CHECK_INTERVAL_MS);
    },
    onNeedRefresh() {
      updateAvailable = true;
      notify();
    },
  });
}
