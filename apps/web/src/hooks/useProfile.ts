import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import type { Publication } from "./usePublications";

export interface Profile {
  username: string;
  displayName: string;
  bio: string;
  avatarUrl: string | null;
  links: string[];
  type: "REAL_NAME" | "PSEUDONYM";
  publicationCount: number;
  commonTags: string[];
  joinedAt: string;
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
