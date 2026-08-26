import * as Device from "expo-device";
import * as Notifications from "expo-notifications";
import { Platform } from "react-native";
import * as SecureStore from "expo-secure-store";
import { api, getToken } from "@/src/lib/api";

const LAST_REGISTERED_KEY = "noteschain.push.lastRegisteredToken";

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
 * The raw native FCM/APNs registration token — not an Expo push token
 * (`ExponentPushToken[...]`). There is no Expo push-relay service in this
 * design; the worker sends via Firebase Admin directly, so the token it
 * needs is the one Firebase itself assigned the device.
 */
async function getNativeDeviceToken(): Promise<string | null> {
  if (!Device.isDevice) return null; // Simulators/emulators without Play services can't register.

  if (Platform.OS === "android") {
    // Required before Android 8+ will deliver anything, independent of the
    // permission prompt below.
    await Notifications.setNotificationChannelAsync("default", {
      name: "NotesChain",
      importance: Notifications.AndroidImportance.DEFAULT,
    });
  }

  const existing = await Notifications.getPermissionsAsync();
  const granted =
    existing.status === "granted" ? true : (await Notifications.requestPermissionsAsync()).status === "granted";
  if (!granted) return null;

  const { data } = await Notifications.getDevicePushTokenAsync();
  return data;
}

/**
 * Registers this device with the API, if the person is signed in, permission
 * is granted (or grantable), and this device supports it at all. Safe to
 * call on every cold start and foreground — the server upserts on the token
 * string, so a repeat call is a no-op, and this is also how a rotated token
 * gets picked back up. Never throws: push is an enhancement, not something
 * that should be able to break app startup.
 */
export async function syncPushRegistration(): Promise<void> {
  try {
    const sessionToken = await getToken();
    if (!sessionToken) return;

    const platform = currentPlatform();
    if (!platform) return;

    const deviceToken = await getNativeDeviceToken();
    if (!deviceToken) return;

    const last = await SecureStore.getItemAsync(LAST_REGISTERED_KEY);
    if (last === deviceToken) return; // Already registered this exact token; skip the round trip.

    await api("/push/tokens", { method: "POST", body: JSON.stringify({ token: deviceToken, platform }) });
    await SecureStore.setItemAsync(LAST_REGISTERED_KEY, deviceToken);
  } catch {
    // Best-effort — a person with notifications off, an emulator without
    // Play services, or a momentary network failure should never surface as
    // an app-startup error.
  }
}

/** Called from Sign out, while the session token is still valid enough to authenticate the request. */
export async function unregisterPushToken(): Promise<void> {
  try {
    const token = await SecureStore.getItemAsync(LAST_REGISTERED_KEY);
    if (!token) return;
    await api("/push/tokens", { method: "DELETE", body: JSON.stringify({ token }) });
    await SecureStore.deleteItemAsync(LAST_REGISTERED_KEY);
  } catch {
    // The token will simply age out server-side (pruned on next failed
    // send) if this doesn't reach the server — never block sign-out on it.
  }
}

export type { Platform_ as PushPlatform };
