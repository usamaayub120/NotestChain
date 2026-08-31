import * as Device from "expo-device";
import * as Notifications from "expo-notifications";
import { Platform } from "react-native";
import * as SecureStore from "expo-secure-store";
import * as Crypto from "expo-crypto";
import { api, getToken } from "@/src/lib/api";

const LAST_REGISTERED_KEY = "noteschain.push.lastRegisteredToken";
const DIAGNOSTIC_KEY = "noteschain.push.lastAttempt";
const INSTALLATION_ID_KEY = "noteschain.push.installationId";
const INSTALLATION_CREDENTIAL_KEY = "noteschain.push.installationCredential";
const PRODUCT_OPT_IN_KEY = "noteschain.push.productOptIn";
const NOTIFICATION_CHANNEL_ID = "noteschain-alerts-v1";
const NOTIFICATION_SOUND = "noteschain_calm_signal.wav";

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
      return "Not available on a simulator - try a real device.";
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
async function getNativeDeviceToken(requestPermission: boolean): Promise<string | null> {
  if (!Device.isDevice) {
    await recordDiagnostic({ state: "simulator" });
    return null;
  }

  if (Platform.OS === "android") {
    // Required before Android 8+ will deliver anything, independent of the
    // permission prompt below.
    try {
      // Android locks a channel's sound after it has been created. This is a
      // versioned ID so existing installations move from the old default
      // channel to this calm, app-specific signal after the native update.
      await Notifications.setNotificationChannelAsync(NOTIFICATION_CHANNEL_ID, {
        name: "NotesChain alerts",
        description: "Comments, moderation decisions, published notes, and new followers.",
        importance: Notifications.AndroidImportance.DEFAULT,
        sound: NOTIFICATION_SOUND,
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
    granted = existing.status === "granted" ? true : requestPermission && (await Notifications.requestPermissionsAsync()).status === "granted";
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

async function installationIdentity() {
  let installationId = await SecureStore.getItemAsync(INSTALLATION_ID_KEY);
  let credential = await SecureStore.getItemAsync(INSTALLATION_CREDENTIAL_KEY);
  if (!installationId) {
    installationId = Crypto.randomUUID();
    await SecureStore.setItemAsync(INSTALLATION_ID_KEY, installationId);
  }
  if (!credential) {
    credential = Array.from(await Crypto.getRandomBytesAsync(32), (part) => part.toString(16).padStart(2, "0")).join("");
    await SecureStore.setItemAsync(INSTALLATION_CREDENTIAL_KEY, credential);
  }
  return { installationId, credential };
}

export async function productUpdatesEnabled() { return (await SecureStore.getItemAsync(PRODUCT_OPT_IN_KEY)) === "true"; }

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
export async function syncPushRegistration(options: { requestPermission?: boolean; productOptIn?: boolean } = {}): Promise<void> {
  try {
    if (!await getToken()) {
      await recordDiagnostic({ state: "signed_out" });
      return;
    }
    const optedIn = options.productOptIn ?? await productUpdatesEnabled();
    if (!optedIn && !options.requestPermission) {
      await recordDiagnostic({ state: "not_attempted" });
      return;
    }

    const platform = currentPlatform();
    if (!platform) {
      await recordDiagnostic({ state: "unsupported_platform" });
      return;
    }

    const deviceToken = await getNativeDeviceToken(options.requestPermission === true);
    if (!deviceToken) return; // getNativeDeviceToken already recorded why.

    const { installationId, credential } = await installationIdentity();
    const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    await api("/push/installations", { method: "POST", appCheck: true, retry: false, body: JSON.stringify({ installationId, credential, token: deviceToken, platform, productOptIn: optedIn || options.productOptIn === true, activityAlertsOptIn: true, permissionGranted: true, timeZone }) });
    await SecureStore.setItemAsync(LAST_REGISTERED_KEY, deviceToken);
    if (optedIn || options.productOptIn) await SecureStore.setItemAsync(PRODUCT_OPT_IN_KEY, "true");
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

/** Called only from the contextual onboarding/settings action. */
export async function enableProductUpdates(): Promise<void> { await syncPushRegistration({ requestPermission: true, productOptIn: true }); }

export async function disableProductUpdates(): Promise<void> {
  const token = await SecureStore.getItemAsync(LAST_REGISTERED_KEY);
  if (!token) { await SecureStore.deleteItemAsync(PRODUCT_OPT_IN_KEY); return; }
  const platform = currentPlatform();
  if (!platform) return;
  const { installationId, credential } = await installationIdentity();
  try {
    await api("/push/installations", { method: "POST", appCheck: true, retry: false, body: JSON.stringify({ installationId, credential, token, platform, productOptIn: false, activityAlertsOptIn: false, permissionGranted: false }) });
  } finally {
    await SecureStore.deleteItemAsync(PRODUCT_OPT_IN_KEY);
    await SecureStore.deleteItemAsync(LAST_REGISTERED_KEY);
    await recordDiagnostic({ state: "not_attempted" });
  }
}

export async function recordCampaignOpen(deliveryToken: string): Promise<void> {
  try {
    const installationId = await SecureStore.getItemAsync(INSTALLATION_ID_KEY);
    const credential = await SecureStore.getItemAsync(INSTALLATION_CREDENTIAL_KEY);
    if (!installationId || !credential) return;
    await api("/push/campaigns/open", { method: "POST", appCheck: true, retry: false, body: JSON.stringify({ installationId, credential, deliveryToken }) });
  } catch {
    // Measurement must never prevent the reader from opening the requested screen.
  }
}

/** Called from Sign out, while the session token is still valid enough to authenticate the request. */
export async function unregisterPushToken(): Promise<void> {
  try {
    const installationId = await SecureStore.getItemAsync(INSTALLATION_ID_KEY);
    const credential = await SecureStore.getItemAsync(INSTALLATION_CREDENTIAL_KEY);
    if (!installationId || !credential) return;
    await api("/push/installations/detach", { method: "POST", appCheck: true, retry: false, body: JSON.stringify({ installationId, credential }) });
  } catch {
    // The token will simply age out server-side (pruned on next failed
    // send) if this doesn't reach the server — never block sign-out on it.
  } finally {
    await SecureStore.deleteItemAsync(LAST_REGISTERED_KEY);
    await recordDiagnostic({ state: "not_attempted" });
  }
}

export type { Platform_ as PushPlatform };

// Exported for push.test.ts only, to seed/inspect the fake SecureStore
// directly rather than duplicating these strings in the test file.
export const TEST_ONLY_KEYS = {
  LAST_REGISTERED_KEY,
  DIAGNOSTIC_KEY,
  INSTALLATION_ID_KEY,
  INSTALLATION_CREDENTIAL_KEY,
  PRODUCT_OPT_IN_KEY,
};
