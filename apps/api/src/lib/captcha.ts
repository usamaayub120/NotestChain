import { env } from "../config/env.js";
import { logger } from "./logger.js";

const VERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify";

interface TurnstileResponse {
  success: boolean;
  "error-codes"?: string[];
}

export async function verifyCaptcha(token: string, remoteIp?: string): Promise<boolean> {
  if (!env.TURNSTILE_SECRET_KEY) {
    logger.warn("TURNSTILE_SECRET_KEY not set — skipping captcha verification (dev only).");
    return true;
  }

  const body = new URLSearchParams({ secret: env.TURNSTILE_SECRET_KEY, response: token });
  if (remoteIp) body.set("remoteip", remoteIp);

  const response = await fetch(VERIFY_URL, { method: "POST", body });
  if (!response.ok) return false;

  const result = (await response.json()) as TurnstileResponse;
  return result.success === true;
}
