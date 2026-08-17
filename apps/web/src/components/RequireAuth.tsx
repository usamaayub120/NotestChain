import type { ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useCurrentUser } from "@/hooks/useAuth";
import { PageLoader, SESSION_CHECK_LOADER_DELAY_MS } from "@/components/Loader";

export function RequireAuth({ children }: { children: ReactNode }) {
  const { data: user, isLoading } = useCurrentUser();
  const location = useLocation();

  // Delayed, so a warm session check stays blank instead of flashing a
  // loader for 80ms. Only a genuinely slow auth round-trip gets a mark —
  // which beats the blank white screen every authenticated route used to
  // show on a cold load.
  if (isLoading) return <PageLoader label="Checking your session" delayMs={SESSION_CHECK_LOADER_DELAY_MS} />;
  if (!user) {
    return <Navigate to={`/login?next=${encodeURIComponent(location.pathname)}`} replace />;
  }
  return <>{children}</>;
}
