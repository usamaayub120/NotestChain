import type { ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { hasPermission, type Permission } from "@noteschain/shared";
import { useCurrentUser } from "@/hooks/useAuth";
import { PageLoader, SESSION_CHECK_LOADER_DELAY_MS } from "@/components/Loader";

export function RequireAnyPermission({ permissions, children }: { permissions: Permission[]; children: ReactNode }) {
  const { data: user, isLoading } = useCurrentUser();
  if (isLoading) return <PageLoader label="Checking your access" delayMs={SESSION_CHECK_LOADER_DELAY_MS} />;
  if (!user) return <Navigate to="/login" replace />;
  if (!permissions.some((permission) => hasPermission(user.roles, permission))) return <div className="mx-auto max-w-xl px-4 py-16 text-muted-foreground">This area isn't available to your account.</div>;
  return <>{children}</>;
}
