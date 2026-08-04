import { useParams } from "react-router-dom";
import { useExplorePublications } from "@/hooks/usePublications";
import { PublicationCard } from "@/components/publication/PublicationCard";
import { CardSkeletonList } from "@/components/CardSkeleton";
import { EmptyState } from "@/components/EmptyState";

export function TagPage() {
  const { tag } = useParams<{ tag: string }>();
  const { data, isLoading } = useExplorePublications(1, tag);

  return (
    <div className="mx-auto max-w-2xl px-4 py-6">
      <h1 className="text-2xl">#{tag}</h1>

      <div className="mt-6">
        {isLoading && <CardSkeletonList />}
        {!isLoading && data?.data.length === 0 && (
          <EmptyState title="Nothing tagged yet" description="No publications use this tag yet." />
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
