import { useQuery } from "@tanstack/react-query";
import { apiFetchPaginated } from "@/lib/api";

export interface MyPublicationAnalytics {
  id: string;
  title: string;
  status: "PUBLISHED";
  publishedAt: string | null;
  createdAt: string;
  uniqueReaders: number;
}

export function useMyPublicationAnalytics(page: number, pageSize = 25) {
  return useQuery({
    queryKey: ["publications", "mine", "analytics", page, pageSize],
    queryFn: () => apiFetchPaginated<MyPublicationAnalytics>(`/publications/mine/analytics?page=${page}&pageSize=${pageSize}`),
  });
}
