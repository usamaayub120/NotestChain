jest.mock("expo-application", () => ({ nativeBuildVersion: null, applicationId: "org.noteschain.app" }));
jest.mock("@/src/lib/api", () => ({ api: jest.fn() }));

import { api } from "@/src/lib/api";
import {
  checkAndroidAppVersion,
  compareAndroidBuild,
  fetchAndroidVersionConfig,
  openAndroidPlayStore,
  parseAndroidVersionConfig,
  parseInstalledBuild,
  type AndroidVersionConfig,
} from "./app-version";

const config: AndroidVersionConfig = { latestBuild: 20, minimumBuild: 17, latestVersion: "1.3.0" };
const mockedApi = api as jest.Mock;

beforeEach(() => {
  jest.clearAllMocks();
  jest.spyOn(console, "warn").mockImplementation(() => undefined);
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe("Android update policy", () => {
  it.each([
    [20, "current"],
    [19, "optional"],
    [17, "optional"],
    [16, "required"],
    [21, "current"],
  ] as const)("classifies installed build %i as %s", (installedBuild, status) => {
    expect(compareAndroidBuild(installedBuild, config)).toBe(status);
  });

  it("rejects malformed and internally inconsistent backend responses", () => {
    expect(() => parseAndroidVersionConfig({ android: { latestBuild: 20, minimumBuild: 17, latestVersion: "1.3.0" } })).not.toThrow();
    expect(() => parseAndroidVersionConfig({ android: { latestBuild: "20", minimumBuild: 17, latestVersion: "1.3.0" } })).toThrow(/invalid Android build/i);
    expect(() => parseAndroidVersionConfig({ android: { latestBuild: 16, minimumBuild: 17, latestVersion: "1.3.0" } })).toThrow(/exceeds latest/i);
    expect(() => parseAndroidVersionConfig({ android: { latestBuild: 20, minimumBuild: 17, latestVersion: "" } })).toThrow(/invalid display/i);
  });

  it("uses a one-shot, bounded request for the version policy", async () => {
    mockedApi.mockResolvedValue({ android: config });

    await expect(fetchAndroidVersionConfig()).resolves.toEqual(config);
    expect(mockedApi).toHaveBeenCalledWith("/app/version", { timeoutMs: 8_000, retry: false });
  });

  it("fails open for an unavailable API or malformed native build number", async () => {
    const unavailable = await checkAndroidAppVersion({
      isAndroid: () => true,
      getInstalledBuild: () => "20",
      fetchConfig: async () => { throw new Error("timeout"); },
    });
    expect(unavailable).toEqual({ status: "check-failed" });

    const fetchConfig = jest.fn(async () => config);
    const nullNativeBuild = await checkAndroidAppVersion({
      isAndroid: () => true,
      getInstalledBuild: () => null,
      fetchConfig,
    });
    expect(nullNativeBuild).toEqual({ status: "check-failed" });
    expect(fetchConfig).not.toHaveBeenCalled();
    expect(parseInstalledBuild("20.1")).toBeNull();
    expect(parseInstalledBuild("0")).toBeNull();
  });

  it("does not apply Android policy to iOS", async () => {
    const fetchConfig = jest.fn(async () => config);
    await expect(checkAndroidAppVersion({ isAndroid: () => false, fetchConfig })).resolves.toEqual({ status: "current" });
    expect(fetchConfig).not.toHaveBeenCalled();
  });
});

describe("Google Play handoff", () => {
  it("uses the market URI and falls back to the HTTPS listing", async () => {
    const openURL = jest.fn().mockRejectedValueOnce(new Error("no market handler")).mockResolvedValueOnce(undefined);
    await expect(openAndroidPlayStore({ openURL }, "org.noteschain.app")).resolves.toBe(true);
    expect(openURL.mock.calls.map(([url]) => url)).toEqual([
      "market://details?id=org.noteschain.app",
      "https://play.google.com/store/apps/details?id=org.noteschain.app",
    ]);
  });

  it("keeps the update gate available when both Play URLs fail", async () => {
    const openURL = jest.fn().mockRejectedValue(new Error("cannot open"));
    await expect(openAndroidPlayStore({ openURL }, "org.noteschain.app")).resolves.toBe(false);
    expect(openURL).toHaveBeenCalledTimes(2);
  });
});
