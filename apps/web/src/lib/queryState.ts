import { ApiNetworkError } from "@/lib/api";

export interface QueryStateLike {
  isLoading: boolean;
  isError: boolean;
  error: unknown;
  /** React Query's fetchStatus: "fetching" | "paused" | "idle". */
  fetchStatus: string;
  data: unknown;
}

/**
 * Whether a list query has failed, including the case React Query does not
 * report as a failure.
 *
 * A request that cannot reach the server can settle at `status: "pending"`
 * with `fetchStatus: "paused"`. In that state `isError` is false, and
 * `isLoading` is false too (it requires `isFetching`), so a page that
 * branches on loading / error / empty renders **nothing at all** -  no
 * skeleton, no message, no empty state. Verified in the running app with the
 * API stopped: the tag page rendered its heading and an empty div.
 *
 * A paused query holding no data is a failure from the reader's point of
 * view, so it is reported as one, with an offline-aware error so ErrorState
 * can say something useful.
 */
export function queryFailure(query: QueryStateLike): { failed: boolean; error: unknown } {
  if (query.isError) return { failed: true, error: query.error };
  if (query.fetchStatus === "paused" && query.data === undefined) {
    return { failed: true, error: new ApiNetworkError(!navigator.onLine) };
  }
  return { failed: false, error: undefined };
}
