import { existsSync } from "node:fs";
import path from "node:path";
import type { ConfigContext, ExpoConfig } from "expo/config";

// Gitignored — present only once someone drops in the real file (see
// android.googleServicesFile below) or a CI step writes it before a build
// (.github/workflows/eas-android-release.yml). Referencing a path that
// doesn't exist makes Expo warn on every command that reads this config, so
// the key is included only when the file is actually there.
const googleServicesFilePath = path.join(__dirname, "google-services.json");
const hasGoogleServicesFile = existsSync(googleServicesFilePath);

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
    // The Firebase Android client config — registers this app with FCM so a
    // build can receive a push at all. Gitignored, same handling as
    // google-service-account.json: not committed, dropped in locally by
    // whoever has it and written from a CI secret before an EAS build (see
    // .github/workflows/eas-android-release.yml). This is the client-side
    // registration piece only — sending a push is a separate credential the
    // worker holds (FIREBASE_SERVICE_ACCOUNT_PATH/_JSON), never this app.
    // Until the file exists, the key is omitted entirely — see above.
    ...(hasGoogleServicesFile ? { googleServicesFile: "./google-services.json" } : {}),
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
    // Lets the three brand faces be bundled into the native build rather
    // than fetched at runtime; see src/lib/fonts.ts.
    "expo-font",
    "@react-native-firebase/app",
    "@react-native-firebase/app-check",
    "expo-secure-store",
    "expo-sqlite",
    [
      "expo-notifications",
      {
        // This short, custom signal is bundled into both native clients. It
        // must be included at build time; an OTA update cannot add it.
        sounds: ["./assets/sounds/noteschain_calm_signal.wav"],
        defaultChannel: "noteschain-alerts-v1",
      },
    ],
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
