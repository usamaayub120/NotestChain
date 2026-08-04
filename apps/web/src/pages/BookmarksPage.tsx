import { useBookmarks } from "@/hooks/useBookmarks";
import { PublicationCard } from "@/components/publication/PublicationCard";
import { CardSkeletonList } from "@/components/CardSkeleton";
import { EmptyState } from "@/components/EmptyState";

export function BookmarksPage() {
  const { data: bookmarks, isLoading } = useBookmarks();

  return (
    <div className="mx-auto max-w-2xl px-4 py-6">
      <h1 className="text-2xl">Saved</h1>

      <div className="mt-6">
        {isLoading && <CardSkeletonList />}
        {!isLoading && bookmarks?.length === 0 && (
          <EmptyState title="Nothing saved yet" description="Bookmark a publication to find it here later." />
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
