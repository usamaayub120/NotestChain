import { Link } from "react-router-dom";
import { useCurrentUser } from "@/hooks/useAuth";
import { DeleteAccountSection } from "@/components/account/DeleteAccountSection";

export function SettingsPage() {
  const { data: user } = useCurrentUser();

  return (
    <div className="mx-auto max-w-2xl px-4 py-10">
      <h1 className="text-2xl">Settings</h1>
      <p className="mt-1 text-muted-foreground">Account and session management.</p>

      <section className="mt-8 rounded-lg border border-border p-5">
        <h2 className="text-lg">Account</h2>
        <p className="mt-2 text-sm text-muted-foreground">Signed in as {user?.email}.</p>
        <p className="mt-4 text-sm text-muted-foreground">
          <Link to="/privacy" className="text-primary underline">
            Privacy policy
          </Link>{" "}
          ·{" "}
          <Link to="/terms" className="text-primary underline">
            Terms of service
          </Link>
        </p>
      </section>

      <section className="mt-6">
        <p className="mb-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">Danger zone</p>
        <DeleteAccountSection />
      </section>
    </div>
  );
}
