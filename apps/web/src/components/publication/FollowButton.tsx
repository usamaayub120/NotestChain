import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useCurrentUser } from "@/hooks/useAuth";
import { useIdentities } from "@/hooks/useIdentities";
import { useFollow, useUnfollow } from "@/hooks/useFollows";

/**
 * Follow/unfollow for a byline. Hidden entirely on any of your own bylines —
 * Keeper profile or pen name — since there's no reading of "follow yourself"
 * that means anything, and for a signed-out visitor, since following
 * requires an account. The API blocks it too (followIdentity checks
 * target.userId), but this is the difference between that rejection never
 * being reachable and it showing up as a confusing error after a click.
 */
export function FollowButton({
  username,
  isFollowing,
  size = "default",
}: {
  username: string;
  isFollowing: boolean;
  size?: "default" | "sm";
}) {
  const { data: user } = useCurrentUser();
  // useIdentities() is only ever populated for a signed-in viewer (its query
  // requires auth), so this stays empty/undefined while signed out.
  const { data: ownIdentities } = useIdentities();
  const follow = useFollow();
  const unfollow = useUnfollow();
  // Optimistic locally: the server response also invalidates the profile
  // query, but that round-trip shouldn't be what makes the button feel right.
  const [optimistic, setOptimistic] = useState<boolean | null>(null);
  // Once the server's own value catches up (via the query invalidation the
  // mutations already trigger), let it take back over — adjusted during
  // render rather than in an effect, the pattern React recommends for
  // resetting local state when a prop changes.
  const [lastSeenIsFollowing, setLastSeenIsFollowing] = useState(isFollowing);
  if (isFollowing !== lastSeenIsFollowing) {
    setLastSeenIsFollowing(isFollowing);
    setOptimistic(null);
  }
  const following = optimistic ?? isFollowing;

  const isOwnByline = ownIdentities?.some((identity) => identity.username === username) ?? false;
  if (!user || isOwnByline) return null;

  const pending = follow.isPending || unfollow.isPending;

  async function toggle() {
    setOptimistic(!following);
    try {
      if (following) await unfollow.mutateAsync(username);
      else await follow.mutateAsync(username);
    } catch {
      setOptimistic(null);
    }
  }

  return (
    <Button
      type="button"
      variant={following ? "outline" : "default"}
      size={size === "sm" ? "sm" : "default"}
      disabled={pending}
      onClick={() => void toggle()}
    >
      {following ? "Following" : "Follow"}
    </Button>
  );
}
