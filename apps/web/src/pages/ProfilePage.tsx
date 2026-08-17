import { useParams, Link } from "react-router-dom";
import { useProfile, useProfilePublications } from "@/hooks/useProfile";
import { PublicationCard } from "@/components/publication/PublicationCard";
import { CardSkeletonList } from "@/components/CardSkeleton";
import { EmptyState } from "@/components/EmptyState";
import { ErrorState } from "@/components/ErrorState";
import { PageLoader } from "@/components/Loader";

export function ProfilePage({ usernameOverride }: { usernameOverride?: string } = {}) {
  const params = useParams<{ username: string }>();
  const username = usernameOverride ?? params.username;
  const { data: profile, isLoading, isError, refetch } = useProfile(username);
  const { data: publications, isLoading: pubsLoading } = useProfilePublications(username);

  if (isLoading) return <PageLoader label="Loading profile" />;
  if (isError || !profile) return <ErrorState message="This profile couldn't be found." onRetry={() => refetch()} />;

  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <div className="flex flex-col items-center text-center">
        <span className="flex h-18 w-18 items-center justify-center overflow-hidden rounded-full bg-muted text-2xl font-medium" style={{ height: 72, width: 72 }}>
          {profile.avatarUrl ? (
            <img src={profile.avatarUrl} alt="" className="h-full w-full object-cover" />
          ) : (
            profile.displayName.slice(0, 1).toUpperCase()
          )}
        </span>
        <h1 className="mt-3 font-display text-2xl">{profile.displayName}</h1>
        <p className="text-muted-foreground">@{profile.username}</p>
        {profile.bio && <p className="mt-2 max-w-sm text-sm">{profile.bio}</p>}
        <p className="mt-2 text-sm text-muted-foreground">
          {profile.publicationCount} kept · joined {new Date(profile.joinedAt).toLocaleDateString(undefined, { month: "short", year: "numeric" })}
        </p>
        {profile.commonTags.length > 0 && (
          <div className="mt-3 flex flex-wrap justify-center gap-2">
            {profile.commonTags.map((tag) => (
              <Link key={tag} to={`/tags/${tag}`} className="rounded-full bg-muted px-3 py-1 text-xs text-muted-foreground">
                #{tag}
              </Link>
            ))}
          </div>
        )}
      </div>

      <div className="mt-8">
        {pubsLoading && <CardSkeletonList />}
        {!pubsLoading && publications?.data.length === 0 && (
          <EmptyState title="Nothing published yet" description="Check back later." />
        )}
        <div className="space-y-3">
          {publications?.data.map((pub) => (
            <PublicationCard key={pub.id} publication={pub} />
          ))}
        </div>
      </div>
    </div>
  );
}
