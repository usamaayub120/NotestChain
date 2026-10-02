import { QueryClient } from "@tanstack/react-query";

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 30_000,
      refetchOnWindowFocus: false,
      // React Query's default networkMode ("online") PAUSES a query that fails
      // for network reasons instead of rejecting it: the query settles at
      // status "pending" / fetchStatus "paused", so `isError` stays false and
      // `isLoading` is false too (it requires isFetching). Every page that
      // branches on isLoading/isError/empty therefore rendered nothing at all
      // for the single most common failure there is.
      //
      // "always" lets the request fail honestly, so the error reaches the UI
      // and ErrorState can tell the reader they're offline and offer a retry.
      // refetchOnReconnect still defaults to true, so a restored connection
      // reloads the data on its own.
      networkMode: "always",
    },
  },
});
