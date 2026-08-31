import { webOrigin } from "@/src/lib/config";

const CAPTCHA_MESSAGE_TYPE = "noteschain-captcha";

/** The first-party page is rendered inside the app's verification sheet. */
export function captchaPageUrl(): string {
  const url = new URL("/mobile-captcha", webOrigin);
  url.searchParams.set("embedded", "1");
  return url.toString();
}

/**
 * Accept only the small, explicit message emitted by our first-party CAPTCHA
 * page. WebView messages are untrusted input, just like API responses.
 */
export function parseCaptchaMessage(data: unknown): string | null {
  if (typeof data !== "string") return null;
  try {
    const message: unknown = JSON.parse(data);
    if (!message || typeof message !== "object") return null;
    const { type, token } = message as { type?: unknown; token?: unknown };
    if (type !== CAPTCHA_MESSAGE_TYPE || typeof token !== "string") return null;
    const trimmed = token.trim();
    return trimmed.length > 0 && trimmed.length <= 4096 ? trimmed : null;
  } catch {
    return null;
  }
}
