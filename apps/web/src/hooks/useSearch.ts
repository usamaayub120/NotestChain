import { useQuery } from "@tanstack/react-query";
import type { Publication } from "./usePublications";

interface SearchParams {
  q?: string;
  tag?: string;
  author?: string;
  identityMode?: string;
  sort?: "relevance" | "newest" | "oldest";
  page?: number;
}

interface Paginated<T> {
  data: T[];
  meta: { page: number; pageSize: number; total: number };
}

export function useSearchPublications(params: SearchParams) {
  const query = new URLSearchParams();
  if (params.q) query.set("q", params.q);
  if (params.tag) query.set("tag", params.tag);
  if (params.author) query.set("author", params.author);
  if (params.identityMode) query.set("identityMode", params.identityMode);
  query.set("sort", params.sort ?? "relevance");
  query.set("page", String(params.page ?? 1));

  return useQuery({
    queryKey: ["search", params],
    queryFn: async () => {
      const res = await fetch(`/api/v1/search?${query.toString()}`, { credentials: "include" });
      const payload = await res.json();
      if (!res.ok) throw new Error(payload?.error?.message ?? "Search failed");
      return payload as Paginated<Publication>;
    },
    enabled: Boolean(params.q || params.tag || params.author || params.identityMode),
  });
}
