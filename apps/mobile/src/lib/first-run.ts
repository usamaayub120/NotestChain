import * as SecureStore from "expo-secure-store";

const storageKey = "noteschain.mobile.onboarding";
// A version string, not a boolean — bumping it can re-show onboarding to
// existing users if the permanence/irreversibility copy materially changes.
const CURRENT_VERSION = "1";

export async function hasSeenOnboarding(): Promise<boolean> {
  const seen = await SecureStore.getItemAsync(storageKey);
  return seen === CURRENT_VERSION;
}

export async function markOnboardingSeen(): Promise<void> {
  await SecureStore.setItemAsync(storageKey, CURRENT_VERSION);
}
