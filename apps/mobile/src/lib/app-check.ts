import { Platform } from "react-native";
import { getApp } from "@react-native-firebase/app";
import { ReactNativeFirebaseAppCheckProvider, getToken, initializeAppCheck, type AppCheck } from "@react-native-firebase/app-check";

let appCheck: AppCheck | null = null;

/** App Check is initialized only when a person has chosen notification consent. */
export async function getAppCheckToken(): Promise<string> {
  if (Platform.OS !== "android" && Platform.OS !== "ios") throw new Error("App Check is unavailable on this platform.");
  if (!appCheck) {
    const provider = new ReactNativeFirebaseAppCheckProvider();
    provider.configure({ android: { provider: "playIntegrity" }, apple: { provider: "appAttestWithDeviceCheckFallback" } });
    appCheck = initializeAppCheck(getApp(), { provider, isTokenAutoRefreshEnabled: false });
  }
  return (await getToken(appCheck, false)).token;
}
