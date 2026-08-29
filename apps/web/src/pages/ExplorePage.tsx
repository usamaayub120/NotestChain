import { useExplorePublications } from "@/hooks/usePublications";
import { PublicationCard } from "@/components/publication/PublicationCard";
import { CardSkeletonList } from "@/components/CardSkeleton";
import { EmptyState } from "@/components/EmptyState";
import { ErrorState } from "@/components/ErrorState";

export function ExplorePage() {
  const { data, isLoading, isError, refetch } = useExplorePublications();

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 md:px-8 lg:py-12">
      <div className="max-w-2xl">
        <h1 className="text-2xl md:text-3xl">Explore notes</h1>
      <p className="mt-1 text-sm text-muted-foreground">Recent notes from the NotesChain community.</p>
      </div>

      <div className="mt-6">
        {isLoading && <CardSkeletonList />}
        {isError && <ErrorState onRetry={() => refetch()} />}
        {!isLoading && !isError && data?.data.length === 0 && (
          <EmptyState title="No notes published yet" description="Be the first to publish a note." />
        )}
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {data?.data.map((pub) => (
            <PublicationCard key={pub.id} publication={pub} />
          ))}
        </div>
      </div>
    </div>
  );
}
