import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";

export interface FollowedIdentity {
  id: string;
  username: string;
  displayName: string;
  avatarUrl: string | null;
  isPrimary: boolean;
  followedAt: string;
}

/**
 * The signed-in Keeper's own following list. There is no equivalent for
 * anyone else's — a following list is visible only to its owner, since it's
 * the strongest correlator between a Keeper and their pen names. See
 * follows.service.ts on the API for the full reasoning.
 */
export function useMyFollowing() {
  return useQuery({
    queryKey: ["follows", "mine"],
    queryFn: () => apiFetch<FollowedIdentity[]>("/follows/mine"),
  });
}

function invalidateFollowState(queryClient: ReturnType<typeof useQueryClient>, username?: string) {
  queryClient.invalidateQueries({ queryKey: ["follows", "mine"] });
  if (username) queryClient.invalidateQueries({ queryKey: ["profiles", username] });
  queryClient.invalidateQueries({ queryKey: ["publications", "explore"] });
}

// Addressed by username, not an identity id: every DTO that renders a byline
// (a note's author, a profile) already carries username, and none of them
// carry PublicIdentity.id — deliberately, since exposing it everywhere would
// serve no purpose once username already does the job.
export function useFollow() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (username: string) => apiFetch(`/follows/${username}`, { method: "POST" }),
    onSuccess: (_data, username) => invalidateFollowState(queryClient, username),
  });
}

export function useUnfollow() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (username: string) => apiFetch(`/follows/${username}`, { method: "DELETE" }),
    onSuccess: (_data, username) => invalidateFollowState(queryClient, username),
  });
}
