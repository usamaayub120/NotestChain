import { useSearchParams } from "react-router-dom";
import { TurnstileWidget } from "@/components/TurnstileWidget";

/**
 * A deliberately small first-party bridge for the native app. Turnstile runs
 * on our HTTPS origin, then the verified token is returned only to the app's
 * registered custom scheme. The API still verifies it with Cloudflare.
 */
export function MobileCaptchaPage() {
  const [params] = useSearchParams();
  const returnTo = params.get("returnTo");
  let callback: URL | null = null;
  try {
    const parsed = returnTo ? new URL(returnTo) : null;
    // Only routes owned by this app may receive a short-lived CAPTCHA token.
    if (parsed?.protocol === "noteschain:" && ["register", "note"].includes(parsed.hostname)) callback = parsed;
  } catch { /* an invalid external value is intentionally rejected below */ }
  const isAllowed = callback !== null;
  if (!isAllowed) return <main className="mx-auto max-w-md px-4 py-10"><h1 className="text-2xl">Invalid return address</h1><p className="mt-2 text-muted-foreground">Open verification from the NotesChain app and try again.</p></main>;

  return (
    <main className="mx-auto max-w-md px-4 py-10">
      <h1 className="text-2xl">Quick verification</h1>
      <p className="mt-2 text-muted-foreground">Complete this check to return to NotesChain.</p>
      <div className="mt-6">
        <TurnstileWidget onVerify={(token) => {
          callback!.searchParams.set("captchaToken", token);
          window.location.assign(callback!.toString());
        }} />
      </div>
    </main>
  );
}
