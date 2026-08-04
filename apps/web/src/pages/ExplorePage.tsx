import { useExplorePublications } from "@/hooks/usePublications";
import { PublicationCard } from "@/components/publication/PublicationCard";
import { CardSkeletonList } from "@/components/CardSkeleton";
import { EmptyState } from "@/components/EmptyState";
import { ErrorState } from "@/components/ErrorState";

export function ExplorePage() {
  const { data, isLoading, isError, refetch } = useExplorePublications();

  return (
    <div className="mx-auto max-w-2xl px-4 py-6">
      <h1 className="text-2xl">Explore</h1>
      <p className="mt-1 text-sm text-muted-foreground">Recently kept thoughts.</p>

      <div className="mt-6">
        {isLoading && <CardSkeletonList />}
        {isError && <ErrorState onRetry={() => refetch()} />}
        {!isLoading && !isError && data?.data.length === 0 && (
          <EmptyState title="Nothing's been kept yet" description="Be the first to publish something." />
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
