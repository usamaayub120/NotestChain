import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiFetch, apiFetchPaginated } from "@/lib/api";

export interface CommentAuthor {
  username: string;
  displayName: string;
  avatarUrl: string | null;
  /** True for the commenter's own Keeper profile, false for a pen name. */
  isPrimary: boolean;
}

export interface CommentDTO {
  id: string;
  parentCommentId: string | null;
  rootCommentId: string | null;
  body: string | null;
  isRemoved: boolean;
  /** Null for a legacy isAnonymous comment, which still renders as "Anonymous" — see authorDisplayName. */
  author: CommentAuthor | null;
  authorDisplayName: string | null;
  isAnonymous: boolean;
  isOwn: boolean;
  createdAt: string;
}

export interface TopLevelCommentDTO extends CommentDTO {
  replies: CommentDTO[];
  repliesTotal: number;
  repliesTruncated: boolean;
}

export function useComments(publicationId: string | undefined, page = 1) {
  return useQuery({
    queryKey: ["comments", publicationId, page],
    queryFn: () => apiFetchPaginated<TopLevelCommentDTO>(`/publications/${publicationId}/comments?page=${page}`),
    enabled: !!publicationId,
  });
}

export function useReplies(rootCommentId: string | undefined, enabled: boolean) {
  return useQuery({
    queryKey: ["comments", "replies", rootCommentId],
    queryFn: () => apiFetchPaginated<CommentDTO>(`/comments/${rootCommentId}/replies?pageSize=50`),
    enabled: enabled && !!rootCommentId,
  });
}

interface CreateCommentVariables {
  publicationId: string;
  body: string;
  parentCommentId?: string;
  /** Which of the commenter's own bylines (Keeper profile or a pen name) to post under. */
  publicIdentityId: string;
  captchaToken: string;
}

export function useCreateComment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ publicationId, ...input }: CreateCommentVariables) =>
      apiFetch(`/publications/${publicationId}/comments`, { method: "POST", body: input }),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["comments", variables.publicationId] });
      if (variables.parentCommentId) {
        queryClient.invalidateQueries({ queryKey: ["comments", "replies"] });
      }
    },
  });
}

export function useDeleteComment(publicationId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (commentId: string) => apiFetch(`/comments/${commentId}`, { method: "DELETE" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["comments", publicationId] });
      queryClient.invalidateQueries({ queryKey: ["comments", "replies"] });
    },
  });
}

export function useReportComment() {
  return useMutation({
    mutationFn: ({ commentId, reason }: { commentId: string; reason: string }) =>
      apiFetch(`/comments/${commentId}/report`, { method: "POST", body: { reason } }),
  });
}

export function useSetCommentsEnabled(publicationId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (commentsEnabled: boolean) =>
      apiFetch(`/publications/${publicationId}/comments-enabled`, { method: "PATCH", body: { commentsEnabled } }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["publications", publicationId] }),
  });
}
