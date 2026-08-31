import { useSearchParams } from "react-router-dom";
import { TurnstileWidget } from "@/components/TurnstileWidget";

declare global {
  interface Window {
    ReactNativeWebView?: { postMessage: (message: string) => void };
  }
}

/**
 * The native app renders this first-party page inside its own verification
 * sheet. On success, the page sends the short-lived Turnstile token through
 * ReactNativeWebView; the API still verifies it with Cloudflare. `returnTo`
 * remains solely for older released apps that used the browser bridge.
 */
export function MobileCaptchaPage() {
  const [params] = useSearchParams();
  const embedded = params.get("embedded") === "1";
  const returnTo = params.get("returnTo");
  let callback: URL | null = null;
  try {
    const parsed = returnTo ? new URL(returnTo) : null;
    // Only routes owned by this app may receive a short-lived CAPTCHA token.
    if (parsed?.protocol === "noteschain:" && ["register", "note"].includes(parsed.hostname)) callback = parsed;
  } catch { /* an invalid external value is intentionally rejected below */ }
  const isAllowed = embedded || callback !== null;
  if (!isAllowed) return <main className="mx-auto max-w-md px-4 py-10"><h1 className="text-2xl">Invalid return address</h1><p className="mt-2 text-muted-foreground">Open verification from the NotesChain app and try again.</p></main>;

  const complete = (token: string) => {
    if (embedded && window.ReactNativeWebView) {
      window.ReactNativeWebView.postMessage(JSON.stringify({ type: "noteschain-captcha", token }));
      return;
    }
    callback!.searchParams.set("captchaToken", token);
    window.location.assign(callback!.toString());
  };

  return (
    <main className="mx-auto max-w-md px-4 py-10">
      <h1 className="text-2xl">Quick verification</h1>
      <p className="mt-2 text-muted-foreground">Complete this check to return to NotesChain.</p>
      <div className="mt-6">
        <TurnstileWidget onVerify={complete} />
      </div>
    </main>
  );
}
