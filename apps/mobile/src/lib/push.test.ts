import * as Notifications from "expo-notifications";
import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";
import { api, getToken } from "@/src/lib/api";

// A plain-value mock gets snapshotted once at import time by Babel's `import
// * as X` interop, so a later `mockDevice.isDevice = false` in a test would
// never be seen by push.ts's own already-materialized binding. A getter
// preserves the accessor across that copy, so it stays live.
let mockIsDevice = true;
jest.mock("expo-device", () => ({
  get isDevice() {
    return mockIsDevice;
  },
}));
jest.mock("expo-notifications", () => ({
  setNotificationHandler: jest.fn(),
  getPermissionsAsync: jest.fn(),
  requestPermissionsAsync: jest.fn(),
  getDevicePushTokenAsync: jest.fn(),
  setNotificationChannelAsync: jest.fn(),
  addNotificationResponseReceivedListener: jest.fn(),
  AndroidImportance: { DEFAULT: 3 },
}));
jest.mock("expo-secure-store", () => ({
  getItemAsync: jest.fn(),
  setItemAsync: jest.fn(),
  deleteItemAsync: jest.fn(),
}));
jest.mock("@/src/lib/api", () => ({ api: jest.fn(), getToken: jest.fn() }));

import { syncPushRegistration, unregisterPushToken } from "./push";

const mockedGetPermissions = Notifications.getPermissionsAsync as jest.Mock;
const mockedRequestPermissions = Notifications.requestPermissionsAsync as jest.Mock;
const mockedGetDeviceToken = Notifications.getDevicePushTokenAsync as jest.Mock;
const mockedGetItem = SecureStore.getItemAsync as jest.Mock;
const mockedSetItem = SecureStore.setItemAsync as jest.Mock;
const mockedDeleteItem = SecureStore.deleteItemAsync as jest.Mock;
const mockedApi = api as jest.Mock;
const mockedGetToken = getToken as jest.Mock;

beforeEach(() => {
  jest.clearAllMocks();
  mockIsDevice = true;
  Object.defineProperty(Platform, "OS", { get: () => "android", configurable: true });
  mockedGetToken.mockResolvedValue("session-token");
  mockedGetPermissions.mockResolvedValue({ status: "granted" });
  mockedGetDeviceToken.mockResolvedValue({ data: "fcm-token-1" });
  mockedGetItem.mockResolvedValue(null);
  // jest.clearAllMocks() clears call history but not a previous test's
  // mockRejectedValue/mockResolvedValue implementation — set fresh every
  // time, the same reason api.test.ts reassigns global.fetch in its own
  // beforeEach rather than relying on clearAllMocks alone.
  mockedApi.mockResolvedValue(undefined);
});

describe("syncPushRegistration", () => {
  it("does nothing when signed out", async () => {
    mockedGetToken.mockResolvedValue(null);

    await syncPushRegistration();

    expect(mockedApi).not.toHaveBeenCalled();
  });

  it("does nothing on a device without push support (no isDevice)", async () => {
    mockIsDevice = false;

    await syncPushRegistration();

    expect(mockedApi).not.toHaveBeenCalled();
  });

  it("requests permission when not yet granted, and registers if granted", async () => {
    mockedGetPermissions.mockResolvedValue({ status: "undetermined" });
    mockedRequestPermissions.mockResolvedValue({ status: "granted" });

    await syncPushRegistration();

    expect(mockedRequestPermissions).toHaveBeenCalled();
    expect(mockedApi).toHaveBeenCalledWith("/push/tokens", { method: "POST", body: JSON.stringify({ token: "fcm-token-1", platform: "ANDROID" }) });
  });

  it("does not register when permission is denied", async () => {
    mockedGetPermissions.mockResolvedValue({ status: "denied" });
    mockedRequestPermissions.mockResolvedValue({ status: "denied" });

    await syncPushRegistration();

    expect(mockedApi).not.toHaveBeenCalled();
  });

  it("registers and remembers the token", async () => {
    await syncPushRegistration();

    expect(mockedApi).toHaveBeenCalledWith("/push/tokens", { method: "POST", body: JSON.stringify({ token: "fcm-token-1", platform: "ANDROID" }) });
    expect(mockedSetItem).toHaveBeenCalledWith(expect.stringContaining("push"), "fcm-token-1");
  });

  it("skips the round trip when this exact token is already registered", async () => {
    mockedGetItem.mockResolvedValue("fcm-token-1");

    await syncPushRegistration();

    expect(mockedApi).not.toHaveBeenCalled();
  });

  it("re-registers when the token has rotated", async () => {
    mockedGetItem.mockResolvedValue("stale-token");

    await syncPushRegistration();

    expect(mockedApi).toHaveBeenCalledWith("/push/tokens", { method: "POST", body: JSON.stringify({ token: "fcm-token-1", platform: "ANDROID" }) });
  });

  it("never throws — a permission/network failure must not break app startup", async () => {
    mockedApi.mockRejectedValue(new Error("network down"));

    await expect(syncPushRegistration()).resolves.toBeUndefined();
  });
});

describe("unregisterPushToken", () => {
  it("does nothing when no token was ever registered", async () => {
    mockedGetItem.mockResolvedValue(null);

    await unregisterPushToken();

    expect(mockedApi).not.toHaveBeenCalled();
  });

  it("unregisters the remembered token and clears it", async () => {
    mockedGetItem.mockResolvedValue("fcm-token-1");

    await unregisterPushToken();

    expect(mockedApi).toHaveBeenCalledWith("/push/tokens", { method: "DELETE", body: JSON.stringify({ token: "fcm-token-1" }) });
    expect(mockedDeleteItem).toHaveBeenCalled();
  });

  it("never throws — sign-out must not be blocked by this", async () => {
    mockedGetItem.mockResolvedValue("fcm-token-1");
    mockedApi.mockRejectedValue(new Error("network down"));

    await expect(unregisterPushToken()).resolves.toBeUndefined();
  });
});
