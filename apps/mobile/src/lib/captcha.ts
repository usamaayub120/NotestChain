import * as Linking from "expo-linking";
import { webOrigin } from "@/src/lib/config";

/** Opens a first-party Turnstile challenge and returns to this exact app route. */
export async function requestCaptcha(returnPath: string) {
  const returnTo = Linking.createURL(returnPath);
  await Linking.openURL(`${webOrigin}/mobile-captcha?returnTo=${encodeURIComponent(returnTo)}`);
}
