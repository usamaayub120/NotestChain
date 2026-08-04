import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";

export interface TagCount {
  tag: string;
  count: number;
}

export function useTags() {
  return useQuery({
    queryKey: ["tags"],
    queryFn: () => apiFetch<TagCount[]>("/tags"),
  });
}
