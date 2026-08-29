import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import type { Publication } from "./usePublications";

export interface Profile {
  username: string;
  displayName: string;
  bio: string;
  avatarUrl: string | null;
  links: string[];
  location: string | null;
  pronouns: string | null;
  /** Present only when the owner has turned its show* flag on. */
  birthDate: string | null;
  gender: string | null;
  type: "REAL_NAME" | "PSEUDONYM";
  /** True for the Keeper's own profile, false for a pen name. */
  isPrimary: boolean;
  publicationCount: number;
  commonTags: string[];
  joinedAt: string;
  /**
   * null below the visibility threshold -  render "New", never 0. There is no
   * endpoint that returns the follower list itself; see the API's
   * follows.service.ts for why.
   */
  followerCount: number | null;
  /** Only meaningful when signed in; false (not omitted) otherwise. */
  isFollowing: boolean;
}

interface Paginated<T> {
  data: T[];
  meta: { page: number; pageSize: number; total: number };
}

export function useProfile(username: string | undefined) {
  return useQuery({
    queryKey: ["profiles", username],
    queryFn: () => apiFetch<Profile>(`/profiles/${username}`),
    enabled: !!username,
  });
}

export function useProfilePublications(username: string | undefined, page = 1) {
  return useQuery({
    queryKey: ["profiles", username, "publications", page],
    queryFn: async () => {
      const res = await fetch(`/api/v1/profiles/${username}/publications?page=${page}`, { credentials: "include" });
      const payload = await res.json();
      if (!res.ok) throw new Error(payload?.error?.message ?? "Request failed");
      return payload as Paginated<Publication>;
    },
    enabled: !!username,
  });
}
