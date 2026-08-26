import { useEffect, useState } from "react";
import { api, getToken } from "@/src/lib/api";
import type { Identity, Profile } from "@/src/lib/models";
import { Action } from "@/src/components/ui";

/**
 * Follow/unfollow for a byline. Renders nothing while signed out, while
 * still loading, or on any of the viewer's own bylines — Keeper profile or
 * pen name — the same three cases apps/web's FollowButton hides for.
 */
export function FollowButton({ username }: { username: string }) {
  const [visible, setVisible] = useState(false);
  const [following, setFollowing] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let mounted = true;
    (async () => {
      const token = await getToken();
      if (!token) return;
      try {
        const [profile, ownIdentities] = await Promise.all([
          api<Profile>(`/profiles/${username}`),
          api<Identity[]>("/identities"),
        ]);
        if (!mounted) return;
        if (ownIdentities.some((identity) => identity.username === username)) return;
        setFollowing(profile.isFollowing);
        setVisible(true);
      } catch {
        // Signed out, or the profile 404s — either way, nothing to show.
      }
    })();
    return () => { mounted = false; };
  }, [username]);

  if (!visible) return null;

  const toggle = async () => {
    setBusy(true);
    try {
      await api(`/follows/${username}`, { method: following ? "DELETE" : "POST" });
      setFollowing((current) => !current);
    } catch {
      // Left as-is; the button just didn't change state, matching web's silent-revert.
    } finally {
      setBusy(false);
    }
  };

  return (
    <Action
      title={following ? "Following" : "Follow"}
      tone={following ? "secondary" : "primary"}
      disabled={busy}
      accessibilityRole="switch"
      accessibilityState={{ checked: following }}
      onPress={() => void toggle()}
    />
  );
}
