import type { ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useCurrentUser } from "@/hooks/useAuth";

export function RequireAuth({ children }: { children: ReactNode }) {
  const { data: user, isLoading } = useCurrentUser();
  const location = useLocation();

  if (isLoading) return null;
  if (!user) {
    return <Navigate to={`/login?next=${encodeURIComponent(location.pathname)}`} replace />;
  }
  return <>{children}</>;
}
