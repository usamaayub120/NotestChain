import * as Application from "expo-application";
import { Linking, Platform } from "react-native";
import { api } from "@/src/lib/api";

export interface AndroidVersionConfig {
  latestBuild: number;
  minimumBuild: number;
  latestVersion: string;
}

export type UpdateStatus = "checking" | "current" | "optional" | "required" | "check-failed";

export type AppVersionCheckResult = {
  status: Exclude<UpdateStatus, "checking">;
  config?: AndroidVersionConfig;
};

const VERSION_CHECK_TIMEOUT_MS = 8_000;
// Kept in sync with app.config.ts. Application.applicationId is preferred on
// real devices; this is the safe fallback when a test/dev runtime omits it.
const ANDROID_PACKAGE_ID = "org.noteschain.app";

function isPositiveInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value > 0;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

/** Reject malformed policy responses rather than treating them as a block. */
export function parseAndroidVersionConfig(value: unknown): AndroidVersionConfig {
  if (!isRecord(value) || !isRecord(value.android)) throw new Error("Version response is missing android policy.");
  const { latestBuild, minimumBuild, latestVersion } = value.android;
  if (!isPositiveInteger(latestBuild) || !isPositiveInteger(minimumBuild)) {
    throw new Error("Version response has invalid Android build numbers.");
  }
  if (minimumBuild > latestBuild) throw new Error("Version response minimum build exceeds latest build.");
  if (typeof latestVersion !== "string" || !latestVersion.trim()) throw new Error("Version response has an invalid display version.");
  return { latestBuild, minimumBuild, latestVersion: latestVersion.trim() };
}

/** Converts the native Android versionCode to a usable positive integer. */
export function parseInstalledBuild(value: string | null | undefined): number | null {
  if (typeof value !== "string" || !/^\d+$/.test(value)) return null;
  const build = Number(value);
  return Number.isSafeInteger(build) && build > 0 ? build : null;
}

export function compareAndroidBuild(installedBuild: number, config: AndroidVersionConfig): Exclude<UpdateStatus, "checking" | "check-failed"> {
  if (installedBuild < config.minimumBuild) return "required";
  if (installedBuild < config.latestBuild) return "optional";
  return "current";
}

export async function fetchAndroidVersionConfig(): Promise<AndroidVersionConfig> {
  const response = await api<unknown>("/app/version", {
    timeoutMs: VERSION_CHECK_TIMEOUT_MS,
    retry: false,
  });
  return parseAndroidVersionConfig(response);
}

type CheckDependencies = {
  isAndroid?: () => boolean;
  getInstalledBuild?: () => string | null | undefined;
  fetchConfig?: () => Promise<AndroidVersionConfig>;
};

/**
 * A failed policy request is intentionally fail-open. This prevents an outage,
 * offline launch, or malformed response from becoming an accidental outage of
 * the whole app; the server enforces configuration validity at startup too.
 */
export async function checkAndroidAppVersion(dependencies: CheckDependencies = {}): Promise<AppVersionCheckResult> {
  try {
    // This endpoint only defines Android versionCode policy. iOS remains
    // unaffected until it has its own independently configured policy.
    if (!(dependencies.isAndroid ?? (() => Platform.OS === "android"))()) return { status: "current" };
    const installedBuild = parseInstalledBuild((dependencies.getInstalledBuild ?? (() => Application.nativeBuildVersion))());
    if (installedBuild === null) throw new Error("Native Android build number is unavailable or invalid.");
    const config = await (dependencies.fetchConfig ?? fetchAndroidVersionConfig)();
    return { status: compareAndroidBuild(installedBuild, config), config };
  } catch (error) {
    // Never include session data or response bodies in this startup log.
    console.warn("[NotesChain version check] allowing app after check failure", {
      reason: error instanceof Error ? error.message : "unknown error",
    });
    return { status: "check-failed" };
  }
}

type UrlOpener = Pick<typeof Linking, "openURL">;

/** Opens the native Play URI first, then its browser equivalent if needed. */
export async function openAndroidPlayStore(
  urlOpener: UrlOpener = Linking,
  packageId = Application.applicationId ?? ANDROID_PACKAGE_ID,
): Promise<boolean> {
  const encodedPackageId = encodeURIComponent(packageId);
  try {
    await urlOpener.openURL(`market://details?id=${encodedPackageId}`);
    return true;
  } catch {
    try {
      await urlOpener.openURL(`https://play.google.com/store/apps/details?id=${encodedPackageId}`);
      return true;
    } catch {
      console.warn("[NotesChain version check] unable to open Google Play listing");
      return false;
    }
  }
}
