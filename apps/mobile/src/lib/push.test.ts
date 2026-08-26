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
// A real (if tiny) in-memory store, not three independent jest.fn()s — the
// diagnostic tests below need setItemAsync's writes to actually be visible
// to a later getPushDiagnostic() read, the same way the real SecureStore
// would behave, not just recorded as call args.
const mockSecureStoreState = new Map<string, string>();
jest.mock("expo-secure-store", () => ({
  getItemAsync: jest.fn((key: string) => Promise.resolve(mockSecureStoreState.get(key) ?? null)),
  setItemAsync: jest.fn((key: string, value: string) => {
    mockSecureStoreState.set(key, value);
    return Promise.resolve();
  }),
  deleteItemAsync: jest.fn((key: string) => {
    mockSecureStoreState.delete(key);
    return Promise.resolve();
  }),
}));
jest.mock("@/src/lib/api", () => ({ api: jest.fn(), getToken: jest.fn() }));

import { TEST_ONLY_KEYS, describePushDiagnostic, getPushDiagnostic, syncPushRegistration, unregisterPushToken } from "./push";

const mockedGetPermissions = Notifications.getPermissionsAsync as jest.Mock;
const mockedRequestPermissions = Notifications.requestPermissionsAsync as jest.Mock;
const mockedGetDeviceToken = Notifications.getDevicePushTokenAsync as jest.Mock;
const mockedSetItem = SecureStore.setItemAsync as jest.Mock;
const mockedDeleteItem = SecureStore.deleteItemAsync as jest.Mock;
const mockedApi = api as jest.Mock;
const mockedGetToken = getToken as jest.Mock;

beforeEach(() => {
  jest.clearAllMocks();
  mockSecureStoreState.clear();
  mockIsDevice = true;
  Object.defineProperty(Platform, "OS", { get: () => "android", configurable: true });
  mockedGetToken.mockResolvedValue("session-token");
  mockedGetPermissions.mockResolvedValue({ status: "granted" });
  mockedGetDeviceToken.mockResolvedValue({ data: "fcm-token-1" });
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
    expect(mockedSetItem).toHaveBeenCalledWith(TEST_ONLY_KEYS.LAST_REGISTERED_KEY, "fcm-token-1");
  });

  it("skips the round trip when this exact token is already registered", async () => {
    mockSecureStoreState.set(TEST_ONLY_KEYS.LAST_REGISTERED_KEY, "fcm-token-1");

    await syncPushRegistration();

    expect(mockedApi).not.toHaveBeenCalled();
  });

  it("re-registers when the token has rotated", async () => {
    mockSecureStoreState.set(TEST_ONLY_KEYS.LAST_REGISTERED_KEY, "stale-token");

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
    await unregisterPushToken();

    expect(mockedApi).not.toHaveBeenCalled();
  });

  it("unregisters the remembered token and clears it", async () => {
    mockSecureStoreState.set(TEST_ONLY_KEYS.LAST_REGISTERED_KEY, "fcm-token-1");

    await unregisterPushToken();

    expect(mockedApi).toHaveBeenCalledWith("/push/tokens", { method: "DELETE", body: JSON.stringify({ token: "fcm-token-1" }) });
    expect(mockedDeleteItem).toHaveBeenCalled();
  });

  it("never throws — sign-out must not be blocked by this", async () => {
    mockSecureStoreState.set(TEST_ONLY_KEYS.LAST_REGISTERED_KEY, "fcm-token-1");
    mockedApi.mockRejectedValue(new Error("network down"));

    await expect(unregisterPushToken()).resolves.toBeUndefined();
  });
});

/**
 * The whole reason getPushDiagnostic/describePushDiagnostic exist: a real
 * production case (permission granted, app updated, yet zero devices ever
 * registered anywhere) turned out to be undiagnosable from server logs
 * alone, because every failure path swallowed its error with no trace.
 * These pin down that every branch actually records what happened.
 */
describe("push diagnostics", () => {
  it("reports not_attempted before anything has ever run", async () => {
    expect(await getPushDiagnostic()).toEqual({ state: "not_attempted" });
  });

  it("records registered after a successful sync", async () => {
    await syncPushRegistration();

    const diagnostic = await getPushDiagnostic();
    expect(diagnostic.state).toBe("registered");
    expect(describePushDiagnostic(diagnostic)).toContain("On, as of");
  });

  it("records signed_out when there is no session", async () => {
    mockedGetToken.mockResolvedValue(null);

    await syncPushRegistration();

    expect(await getPushDiagnostic()).toEqual({ state: "signed_out" });
  });

  it("records permission_denied when the OS permission is refused", async () => {
    mockedGetPermissions.mockResolvedValue({ status: "denied" });
    mockedRequestPermissions.mockResolvedValue({ status: "denied" });

    await syncPushRegistration();

    expect(await getPushDiagnostic()).toEqual({ state: "permission_denied" });
    expect(describePushDiagnostic({ state: "permission_denied" })).toMatch(/turned off/i);
  });

  it("records simulator when the device isn't a real one", async () => {
    mockIsDevice = false;

    await syncPushRegistration();

    expect(await getPushDiagnostic()).toEqual({ state: "simulator" });
  });

  it("records a failed diagnostic — with the real error message — when native token retrieval throws", async () => {
    // This is the exact production scenario that motivated this whole file:
    // permission granted, everything upstream fine, and the native call
    // itself throws (a misconfigured Firebase project is the likely real-
    // world cause). Before this diagnostic existed, this was indistinguishable
    // from "nobody ever tried."
    mockedGetDeviceToken.mockRejectedValue(new Error("SERVICE_NOT_AVAILABLE"));

    await syncPushRegistration();

    const diagnostic = await getPushDiagnostic();
    expect(diagnostic).toEqual({ state: "failed", step: "device token", message: "SERVICE_NOT_AVAILABLE", at: expect.any(String) });
    expect(describePushDiagnostic(diagnostic)).toContain("SERVICE_NOT_AVAILABLE");
  });

  it("records a failed diagnostic when the server round trip itself fails", async () => {
    mockedApi.mockRejectedValue(new Error("network down"));

    await syncPushRegistration();

    const diagnostic = await getPushDiagnostic();
    expect(diagnostic).toEqual({ state: "failed", step: "registering with NotesChain", message: "network down", at: expect.any(String) });
  });

  it("clears back to not_attempted on unregister", async () => {
    await syncPushRegistration();
    expect((await getPushDiagnostic()).state).toBe("registered");

    await unregisterPushToken();

    expect(await getPushDiagnostic()).toEqual({ state: "not_attempted" });
  });
});
