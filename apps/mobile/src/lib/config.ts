import Constants from "expo-constants";

export type AppEnv = "development" | "preview" | "production";

const isAppEnv = (value: unknown): value is AppEnv => value === "development" || value === "preview" || value === "production";

const extra = Constants.expoConfig?.extra as { appEnv?: unknown; apiOrigin?: unknown; webOrigin?: unknown } | undefined;

// Hard default to production — a build that somehow lost its `extra` block
// must never silently point at a dev/staging origin.
export const appEnv: AppEnv = isAppEnv(extra?.appEnv) ? extra.appEnv : "production";
export const apiOrigin: string = typeof extra?.apiOrigin === "string" && extra.apiOrigin ? extra.apiOrigin : "https://noteschain.org";
export const webOrigin: string = typeof extra?.webOrigin === "string" && extra.webOrigin ? extra.webOrigin : "https://noteschain.org";
export const apiRoot = `${apiOrigin}/api/v1`;
