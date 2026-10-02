import type { ReactNode } from "react";
import { CardSkeletonList } from "@/components/CardSkeleton";
import { ErrorState } from "@/components/ErrorState";
import { queryFailure } from "@/lib/queryState";

/**
 * Loading / failed / empty for an admin list, in one place.
 *
 * Each admin page used to spell out its own `isLoading` and empty branches
 * and skip the failed one entirely, so a request that errored fell through to
 * "Nothing pending" or "No campaigns yet." A moderator could not tell an
 * empty queue from a queue that failed to load, which on the moderation and
 * reports screens is the difference between "no work" and "work you can't
 * see".
 *
 * Returns null once there is something to render, so the caller's table still
 * owns the success path.
 */
export function AdminQueryState({
  isLoading,
  isError,
  error,
  fetchStatus,
  data,
  onRetry,
  isEmpty,
  empty,
}: {
  isLoading: boolean;
  isError?: boolean;
  error?: unknown;
  /** Pass the query's fetchStatus and data so a paused request is caught too. */
  fetchStatus?: string;
  data?: unknown;
  onRetry?: () => void;
  isEmpty?: boolean;
  empty?: ReactNode;
}) {
  const failure = queryFailure({
    isLoading,
    isError: Boolean(isError),
    error,
    fetchStatus: fetchStatus ?? "idle",
    data,
  });

  if (isLoading) {
    return (
      <div className="mt-6">
        <CardSkeletonList />
      </div>
    );
  }
  if (failure.failed) {
    return (
      <div className="mt-6">
        <ErrorState error={failure.error} onRetry={onRetry} />
      </div>
    );
  }
  if (isEmpty) return <div className="mt-6">{empty}</div>;
  return null;
}
