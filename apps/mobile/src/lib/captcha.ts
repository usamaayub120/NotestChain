import * as Linking from "expo-linking";

/** Opens a first-party Turnstile challenge and returns to this exact app route. */
export async function requestCaptcha(returnPath: string) {
  const returnTo = Linking.createURL(returnPath);
  await Linking.openURL(`https://noteschain.org/mobile-captcha?returnTo=${encodeURIComponent(returnTo)}`);
}
