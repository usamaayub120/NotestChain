import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import type { Publication } from "./usePublications";

export interface Bookmark {
  id: string;
  createdAt: string;
  collectionId: string | null;
  collectionName: string | null;
  publication: Publication;
}

export function useBookmarks() {
  return useQuery({
    queryKey: ["bookmarks"],
    queryFn: () => apiFetch<Bookmark[]>("/bookmarks"),
  });
}

export function useAddBookmark() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (publicationId: string) =>
      apiFetch("/bookmarks", { method: "POST", body: { publicationId } }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["bookmarks"] }),
  });
}

export function useRemoveBookmark() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (publicationId: string) => apiFetch(`/bookmarks/${publicationId}`, { method: "DELETE" }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["bookmarks"] }),
  });
}
