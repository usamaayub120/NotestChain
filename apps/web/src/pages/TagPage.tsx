import { useParams } from "react-router-dom";
import { useExplorePublications } from "@/hooks/usePublications";
import { PublicationCard } from "@/components/publication/PublicationCard";
import { CardSkeletonList } from "@/components/CardSkeleton";
import { EmptyState } from "@/components/EmptyState";
import { ErrorState } from "@/components/ErrorState";
import { queryFailure } from "@/lib/queryState";

export function TagPage() {
  const { tag } = useParams<{ tag: string }>();
  const { data, isLoading, isError, error, refetch, fetchStatus } = useExplorePublications(1, tag);
  const failure = queryFailure({ isLoading, isError, error, fetchStatus, data });

  return (
    <div className="mx-auto max-w-2xl px-4 py-6">
      <h1 className="text-2xl">#{tag}</h1>

      <div className="mt-6">
        {isLoading && <CardSkeletonList />}
        {!isLoading && failure.failed && <ErrorState error={failure.error} onRetry={() => refetch()} />}
        {!isLoading && !failure.failed && data?.data.length === 0 && (
          <EmptyState title="Nothing tagged yet" description="No notes use this tag yet." />
        )}
        <div className="space-y-3">
          {data?.data.map((pub) => (
            <PublicationCard key={pub.id} publication={pub} />
          ))}
        </div>
      </div>
    </div>
  );
}
