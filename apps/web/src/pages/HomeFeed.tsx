import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PublicationCard } from "@/components/publication/PublicationCard";
import { CardSkeletonList } from "@/components/CardSkeleton";
import { EmptyState } from "@/components/EmptyState";
import { ErrorState } from "@/components/ErrorState";
import { useExplorePublications, useFollowingPublications } from "@/hooks/usePublications";
import { useMyFollowing } from "@/hooks/useFollows";

/**
 * The signed-in home screen: Following is the default once you follow
 * anyone, Latest otherwise — a new reader is never staring at an empty
 * tab. Marketing HomePage.tsx renders this in place of its own content once
 * a session exists; Explore stays the separate, tab-free discovery surface.
 */
export function HomeFeed() {
  const { data: following } = useMyFollowing();
  const [tab, setTab] = useState<"following" | "latest" | null>(null);
  const activeTab = tab ?? (following && following.length > 0 ? "following" : "latest");

  return (
    <div className="mx-auto max-w-2xl px-4 py-6">
      <Tabs value={activeTab} onValueChange={(v) => setTab(v as "following" | "latest")}>
        <TabsList>
          <TabsTrigger value="following">Following</TabsTrigger>
          <TabsTrigger value="latest">Latest</TabsTrigger>
        </TabsList>
        <TabsContent value="following" className="mt-4">
          <FollowingTab hasFollows={Boolean(following && following.length > 0)} />
        </TabsContent>
        <TabsContent value="latest" className="mt-4">
          <LatestTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function FollowingTab({ hasFollows }: { hasFollows: boolean }) {
  const { data, isLoading, isError, refetch } = useFollowingPublications(1, hasFollows);

  if (!hasFollows) {
    return (
      <EmptyState
        title="Follow a few authors"
        description="Their notes will show up here. In the meantime, Explore has recent notes from everyone."
      />
    );
  }

  return (
    <div>
      {isLoading && <CardSkeletonList />}
      {isError && <ErrorState onRetry={() => refetch()} />}
      {!isLoading && !isError && data?.data.length === 0 && (
        <EmptyState title="Nothing new yet" description="Nobody you follow has published recently." />
      )}
      <div className="space-y-3">
        {data?.data.map((pub) => (
          <PublicationCard key={pub.id} publication={pub} />
        ))}
      </div>
    </div>
  );
}

function LatestTab() {
  const { data, isLoading, isError, refetch } = useExplorePublications();

  return (
    <div>
      {isLoading && <CardSkeletonList />}
      {isError && <ErrorState onRetry={() => refetch()} />}
      {!isLoading && !isError && data?.data.length === 0 && (
        <EmptyState title="No notes published yet" description="Be the first to publish a note." />
      )}
      <div className="space-y-3">
        {data?.data.map((pub) => (
          <PublicationCard key={pub.id} publication={pub} />
        ))}
      </div>
    </div>
  );
}
