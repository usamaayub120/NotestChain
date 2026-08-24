import type { ConfigContext, ExpoConfig } from "expo/config";

type AppEnv = "development" | "preview" | "production";
const APP_ENV: AppEnv = (process.env.APP_ENV as AppEnv | undefined) ?? "production";

/**
 * There is no staging environment today — `preview` intentionally defaults to
 * production so testers exercise the real API (with a test account), rather
 * than standing up a separate staging stack as a side effect of this config.
 * A developer can still point `development` at a LAN API via .env (see
 * .env.example) without baking a loopback address into a committed profile.
 */
const originsByEnv: Record<AppEnv, { apiOrigin: string; webOrigin: string }> = {
  development: {
    apiOrigin: process.env.EXPO_PUBLIC_API_ORIGIN ?? "https://noteschain.org",
    webOrigin: process.env.EXPO_PUBLIC_WEB_ORIGIN ?? "https://noteschain.org",
  },
  preview: {
    apiOrigin: process.env.EXPO_PUBLIC_API_ORIGIN ?? "https://noteschain.org",
    webOrigin: process.env.EXPO_PUBLIC_WEB_ORIGIN ?? "https://noteschain.org",
  },
  production: {
    apiOrigin: "https://noteschain.org",
    webOrigin: "https://noteschain.org",
  },
};

const { apiOrigin, webOrigin } = originsByEnv[APP_ENV];

export default (_ctx: ConfigContext): ExpoConfig => ({
  name: "NotesChain",
  slug: "noteschain",
  scheme: "noteschain",
  version: "1.0.0",
  icon: "./assets/icon.png",
  orientation: "portrait",
  userInterfaceStyle: "automatic",
  ios: {
    bundleIdentifier: "org.noteschain.app",
    associatedDomains: ["applinks:noteschain.org"],
  },
  android: {
    package: "org.noteschain.app",
    adaptiveIcon: {
      foregroundImage: "./assets/adaptive-icon.png",
      backgroundColor: "#F6F1E8",
    },
    intentFilters: [
      {
        action: "VIEW",
        autoVerify: true,
        data: [{ scheme: "https", host: "noteschain.org", pathPrefix: "/" }],
        category: ["BROWSABLE", "DEFAULT"],
      },
    ],
  },
  plugins: [
    "expo-router",
    "expo-secure-store",
    "expo-sqlite",
    // Expo SDK 52's default template still targets API 34; Play Console now
    // requires 35 for any new release (raised after this SDK's templates
    // were set, so it has to be overridden explicitly rather than relying
    // on the generated android/build.gradle's own default).
    ["expo-build-properties", { android: { kotlinVersion: "1.9.25", targetSdkVersion: 35 } }],
    "./plugins/withExpoAutolinkingPackageFix",
  ],
  experiments: {
    typedRoutes: true,
  },
  extra: {
    router: { origin: false },
    eas: { projectId: "7ef4befc-5352-4d71-9743-0266664dde9c" },
    appEnv: APP_ENV,
    apiOrigin,
    webOrigin,
  },
  owner: "usamaayub00",
});
