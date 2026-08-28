import { QueryClient } from "@tanstack/react-query";

/**
 * Shared so mutations initiated outside a screen can keep list caches current.
 * Safe reads already retry once in api.ts; allowing React Query to retry them
 * again made an offline launch spend up to several minutes on a spinner.
 */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: false },
  },
});
