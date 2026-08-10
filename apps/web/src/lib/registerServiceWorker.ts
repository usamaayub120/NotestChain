import { registerSW } from "virtual:pwa-register";

// Long-lived tabs (someone leaves NotesChain open in a background tab for
// hours) wouldn't otherwise notice a new deploy until their next full
// navigation — this polls for one directly so the update lands without
// that.
const UPDATE_CHECK_INTERVAL_MS = 60 * 60 * 1000;

export function registerServiceWorker() {
  if (!("serviceWorker" in navigator)) return;

  const updateSW = registerSW({
    onRegisteredSW(_url, registration) {
      if (!registration) return;
      setInterval(() => {
        registration.update().catch(() => {});
      }, UPDATE_CHECK_INTERVAL_MS);
    },
    onNeedRefresh() {
      // Activates the new version and reloads immediately rather than
      // waiting on user action — see vite.config.ts's registerType comment.
      updateSW(true);
    },
  });
}
