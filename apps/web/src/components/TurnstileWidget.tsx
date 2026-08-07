import { useEffect, useId, useRef } from "react";

declare global {
  interface Window {
    turnstile?: {
      render: (container: HTMLElement, options: { sitekey: string; callback: (token: string) => void }) => string;
      remove: (widgetId: string) => void;
    };
  }
}

const SCRIPT_SRC = "https://challenges.cloudflare.com/turnstile/v0/api.js";
const SITE_KEY = import.meta.env.VITE_TURNSTILE_SITE_KEY as string | undefined;

let scriptLoadPromise: Promise<void> | null = null;
function loadTurnstileScript(): Promise<void> {
  if (window.turnstile) return Promise.resolve();
  if (!scriptLoadPromise) {
    scriptLoadPromise = new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = SCRIPT_SRC;
      script.async = true;
      script.onload = () => resolve();
      script.onerror = () => reject(new Error("Failed to load Turnstile"));
      document.head.appendChild(script);
    });
  }
  return scriptLoadPromise;
}

/**
 * Renders nothing and immediately reports a placeholder token when no site
 * key is configured — lets registration/comments work in local dev without
 * a Cloudflare account. The API's own verifyCaptcha() has the matching
 * bypass when TURNSTILE_SECRET_KEY is unset (see apps/api/src/lib/captcha.ts).
 */
export function TurnstileWidget({ onVerify }: { onVerify: (token: string) => void }) {
  const containerId = useId();
  const widgetIdRef = useRef<string | null>(null);
  const onVerifyRef = useRef(onVerify);
  useEffect(() => {
    onVerifyRef.current = onVerify;
  });

  useEffect(() => {
    if (!SITE_KEY) {
      onVerifyRef.current("dev-bypass-no-site-key");
      return;
    }

    let cancelled = false;
    loadTurnstileScript().then(() => {
      if (cancelled) return;
      const container = document.getElementById(containerId);
      if (!container || !window.turnstile) return;
      widgetIdRef.current = window.turnstile.render(container, {
        sitekey: SITE_KEY,
        callback: (token) => onVerifyRef.current(token),
      });
    });

    return () => {
      cancelled = true;
      if (widgetIdRef.current && window.turnstile) window.turnstile.remove(widgetIdRef.current);
    };
  }, [containerId]);

  if (!SITE_KEY) return null;
  return <div id={containerId} />;
}
