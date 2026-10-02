import { useBookmarks } from "@/hooks/useBookmarks";
import { PublicationCard } from "@/components/publication/PublicationCard";
import { CardSkeletonList } from "@/components/CardSkeleton";
import { EmptyState } from "@/components/EmptyState";
import { ErrorState } from "@/components/ErrorState";
import { queryFailure } from "@/lib/queryState";

export function BookmarksPage() {
  const { data: bookmarks, isLoading, isError, error, refetch, fetchStatus } = useBookmarks();
  const failure = queryFailure({ isLoading, isError, error, fetchStatus, data: bookmarks });

  return (
    <div className="mx-auto max-w-2xl px-4 py-6">
      <h1 className="text-2xl">Saved</h1>

      <div className="mt-6">
        {isLoading && <CardSkeletonList />}
        {!isLoading && failure.failed && <ErrorState error={failure.error} onRetry={() => refetch()} />}
        {!isLoading && !failure.failed && bookmarks?.length === 0 && (
          <EmptyState title="Nothing saved yet" description="Bookmark a note to find it here later." />
        )}
        <div className="space-y-3">
          {bookmarks?.map((bookmark) => (
            <PublicationCard key={bookmark.id} publication={bookmark.publication} />
          ))}
        </div>
      </div>
    </div>
  );
}
