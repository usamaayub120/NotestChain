import { Link } from "react-router-dom";
import { brand } from "@noteschain/shared";
import { useCurrentUser } from "@/hooks/useAuth";
import { DeleteAccountSection } from "@/components/account/DeleteAccountSection";
import { PageLoader, SESSION_CHECK_LOADER_DELAY_MS } from "@/components/Loader";

/**
 * The public, no-app-required page Google Play's account-deletion requirement
 * points at -  reachable and readable while signed out, and performs the
 * actual deletion once signed in, reusing the same section Settings uses.
 */
export function DeleteAccountPage() {
  const { data: user, isLoading } = useCurrentUser();

  if (isLoading) return <PageLoader label="Checking your session" delayMs={SESSION_CHECK_LOADER_DELAY_MS} />;

  return (
    <div className="mx-auto max-w-2xl px-4 py-10 md:py-16">
      <h1 className="font-display text-3xl">Delete your {brand.name} account</h1>

      {user ? (
        <div className="mt-8">
          <DeleteAccountSection />
        </div>
      ) : (
        <div className="mt-4 max-w-reading text-muted-foreground">
          <p>
            Sign in and come back to this page, or go to Settings once you're in -  either way it takes one
            confirmation.
          </p>
          <p className="mt-3">
            If you can't sign in, email{" "}
            <a href={`mailto:${brand.supportEmail}`} className="text-primary underline">
              {brand.supportEmail}
            </a>{" "}
            and we'll delete it for you.
          </p>
          <Link to={`/login?next=${encodeURIComponent("/delete-account")}`} className="mt-6 inline-block text-primary underline">
            Sign in
          </Link>
        </div>
      )}
    </div>
  );
}
