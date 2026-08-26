import * as Device from "expo-device";
import * as Notifications from "expo-notifications";
import { Platform } from "react-native";
import * as SecureStore from "expo-secure-store";
import { api, getToken } from "@/src/lib/api";

const LAST_REGISTERED_KEY = "noteschain.push.lastRegisteredToken";
const DIAGNOSTIC_KEY = "noteschain.push.lastAttempt";

/**
 * Notifications alert, play a sound, and update no badge while the app is
 * in the foreground — badges track something like "unread count," which
 * this app has no concept of.
 */
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

type Platform_ = "IOS" | "ANDROID";

function currentPlatform(): Platform_ | null {
  if (Platform.OS === "ios") return "IOS";
  if (Platform.OS === "android") return "ANDROID";
  return null;
}

/**
 * What happened the last time this device tried to register for push, in
 * plain enough language to show on a Settings screen. This is the only
 * window either a reader or we have into a failure that otherwise happens
 * entirely inside a native SDK, with nothing surfacing in any server log —
 * syncPushRegistration() had no visibility of its own before this, which
 * made a real failure indistinguishable from "nobody tried yet."
 */
export type PushDiagnostic =
  | { state: "not_attempted" }
  | { state: "signed_out" }
  | { state: "unsupported_platform" }
  | { state: "simulator" }
  | { state: "permission_denied" }
  | { state: "registered"; at: string }
  | { state: "failed"; step: string; message: string; at: string };

async function recordDiagnostic(diagnostic: PushDiagnostic): Promise<void> {
  await SecureStore.setItemAsync(DIAGNOSTIC_KEY, JSON.stringify(diagnostic));
}

export async function getPushDiagnostic(): Promise<PushDiagnostic> {
  const raw = await SecureStore.getItemAsync(DIAGNOSTIC_KEY);
  if (!raw) return { state: "not_attempted" };
  try {
    return JSON.parse(raw) as PushDiagnostic;
  } catch {
    return { state: "not_attempted" };
  }
}

/** One line of plain-language copy for whatever getPushDiagnostic() returns. */
export function describePushDiagnostic(diagnostic: PushDiagnostic): string {
  switch (diagnostic.state) {
    case "not_attempted":
      return "Not set up yet.";
    case "signed_out":
      return "Sign in, then reopen the app to turn this on.";
    case "unsupported_platform":
      return "Not available on this device.";
    case "simulator":
      return "Not available on a simulator — try a real device.";
    case "permission_denied":
      return "Notifications are turned off for NotesChain in your device settings.";
    case "registered":
      return `On, as of ${new Date(diagnostic.at).toLocaleString()}.`;
    case "failed":
      return `Couldn't turn this on (${diagnostic.step}): ${diagnostic.message}`;
  }
}

/**
 * The raw native FCM/APNs registration token — not an Expo push token
 * (`ExponentPushToken[...]`). There is no Expo push-relay service in this
 * design; the worker sends via Firebase Admin directly, so the token it
 * needs is the one Firebase itself assigned the device.
 *
 * Every early return and thrown error is paired with a recordDiagnostic()
 * call — this function used to fail into a bare `null`/exception with no
 * trace of why, which made a real bug (nobody's device ever registered)
 * indistinguishable from "permission not granted yet" from the server side.
 */
async function getNativeDeviceToken(): Promise<string | null> {
  if (!Device.isDevice) {
    await recordDiagnostic({ state: "simulator" });
    return null;
  }

  if (Platform.OS === "android") {
    // Required before Android 8+ will deliver anything, independent of the
    // permission prompt below.
    try {
      await Notifications.setNotificationChannelAsync("default", {
        name: "NotesChain",
        importance: Notifications.AndroidImportance.DEFAULT,
      });
    } catch (e) {
      await recordDiagnostic({
        state: "failed",
        step: "notification channel",
        message: e instanceof Error ? e.message : String(e),
        at: new Date().toISOString(),
      });
      return null;
    }
  }

  let granted: boolean;
  try {
    const existing = await Notifications.getPermissionsAsync();
    granted = existing.status === "granted" ? true : (await Notifications.requestPermissionsAsync()).status === "granted";
  } catch (e) {
    await recordDiagnostic({
      state: "failed",
      step: "permission request",
      message: e instanceof Error ? e.message : String(e),
      at: new Date().toISOString(),
    });
    return null;
  }
  if (!granted) {
    await recordDiagnostic({ state: "permission_denied" });
    return null;
  }

  try {
    const { data } = await Notifications.getDevicePushTokenAsync();
    return data;
  } catch (e) {
    // The most likely real-world failure point: this is where a
    // misconfigured Firebase project (Cloud Messaging API not enabled,
    // mismatched package name, missing/invalid google-services.json at
    // build time) or missing/outdated Google Play Services actually
    // surfaces — everything above this rarely throws.
    await recordDiagnostic({
      state: "failed",
      step: "device token",
      message: e instanceof Error ? e.message : String(e),
      at: new Date().toISOString(),
    });
    return null;
  }
}

/**
 * Registers this device with the API, if the person is signed in, permission
 * is granted (or grantable), and this device supports it at all. Safe to
 * call on every cold start and foreground — the server upserts on the token
 * string, so a repeat call is a no-op, and this is also how a rotated token
 * gets picked back up. Never throws: push is an enhancement, not something
 * that should be able to break app startup. What happened is always
 * recorded via recordDiagnostic() rather than swallowed, so Settings can
 * show it — see getPushDiagnostic().
 */
export async function syncPushRegistration(): Promise<void> {
  try {
    const sessionToken = await getToken();
    if (!sessionToken) {
      await recordDiagnostic({ state: "signed_out" });
      return;
    }

    const platform = currentPlatform();
    if (!platform) {
      await recordDiagnostic({ state: "unsupported_platform" });
      return;
    }

    const deviceToken = await getNativeDeviceToken();
    if (!deviceToken) return; // getNativeDeviceToken already recorded why.

    const last = await SecureStore.getItemAsync(LAST_REGISTERED_KEY);
    if (last === deviceToken) {
      await recordDiagnostic({ state: "registered", at: new Date().toISOString() });
      return; // Already registered this exact token; skip the round trip.
    }

    await api("/push/tokens", { method: "POST", body: JSON.stringify({ token: deviceToken, platform }) });
    await SecureStore.setItemAsync(LAST_REGISTERED_KEY, deviceToken);
    await recordDiagnostic({ state: "registered", at: new Date().toISOString() });
  } catch (e) {
    await recordDiagnostic({
      state: "failed",
      step: "registering with NotesChain",
      message: e instanceof Error ? e.message : String(e),
      at: new Date().toISOString(),
    });
  }
}

/** Called from Sign out, while the session token is still valid enough to authenticate the request. */
export async function unregisterPushToken(): Promise<void> {
  try {
    const token = await SecureStore.getItemAsync(LAST_REGISTERED_KEY);
    if (!token) return;
    await api("/push/tokens", { method: "DELETE", body: JSON.stringify({ token }) });
    await SecureStore.deleteItemAsync(LAST_REGISTERED_KEY);
    await recordDiagnostic({ state: "not_attempted" });
  } catch {
    // The token will simply age out server-side (pruned on next failed
    // send) if this doesn't reach the server — never block sign-out on it.
  }
}

export type { Platform_ as PushPlatform };

// Exported for push.test.ts only, to seed/inspect the fake SecureStore
// directly rather than duplicating these strings in the test file.
export const TEST_ONLY_KEYS = { LAST_REGISTERED_KEY, DIAGNOSTIC_KEY };
