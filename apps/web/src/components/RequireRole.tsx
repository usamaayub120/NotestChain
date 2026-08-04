import type { ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { useCurrentUser } from "@/hooks/useAuth";

const ROLE_RANK: Record<string, number> = { USER: 0, MODERATOR: 1, ADMIN: 2 };

export function RequireRole({ role, children }: { role: "MODERATOR" | "ADMIN"; children: ReactNode }) {
  const { data: user, isLoading } = useCurrentUser();

  if (isLoading) return null;
  if (!user) return <Navigate to="/login" replace />;
  if ((ROLE_RANK[user.role] ?? -1) < (ROLE_RANK[role] ?? 0)) {
    return (
      <div className="mx-auto max-w-md px-4 py-16 text-center text-muted-foreground">
        This part of NotesChain isn't available to your account.
      </div>
    );
  }
  return <>{children}</>;
}
