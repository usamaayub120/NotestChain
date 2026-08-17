import type { ReactNode } from "react";
import { Link, Navigate } from "react-router-dom";
import { useCurrentUser } from "@/hooks/useAuth";
import { PageLoader, SESSION_CHECK_LOADER_DELAY_MS } from "@/components/Loader";

const ROLE_RANK: Record<string, number> = { USER: 0, MODERATOR: 1, ADMIN: 2 };

export function RequireRole({ role, children }: { role: "MODERATOR" | "ADMIN"; children: ReactNode }) {
  const { data: user, isLoading } = useCurrentUser();

  if (isLoading) return <PageLoader label="Checking your session" delayMs={SESSION_CHECK_LOADER_DELAY_MS} />;
  if (!user) return <Navigate to="/login" replace />;
  if ((ROLE_RANK[user.role] ?? -1) < (ROLE_RANK[role] ?? 0)) {
    return (
      <div className="mx-auto max-w-md px-4 py-16 text-center text-muted-foreground">
        <p>This part of NotesChain isn't available to your account.</p>
        <Link to="/" className="mt-4 inline-flex min-h-11 items-center text-primary underline">
          Back to NotesChain
        </Link>
      </div>
    );
  }
  return <>{children}</>;
}
