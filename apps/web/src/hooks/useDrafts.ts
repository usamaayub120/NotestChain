import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { QueryClient } from "@tanstack/react-query";
import type { AutosaveInput, UpdateDraftInput } from "@noteschain/validation";
import type { IdentityMode } from "@noteschain/shared";
import { apiFetch } from "@/lib/api";

export interface Draft {
  id: string;
  title: string;
  content: string;
  contentFormat?: "PLAINTEXT" | "MARKDOWN";
  tags: string[];
  identityMode: IdentityMode;
  publicIdentityId: string | null;
  discoverability: "PUBLIC" | "UNLISTED";
  status:
    | "DRAFT"
    | "PENDING_REVIEW"
    | "CHANGES_REQUESTED"
    | "REJECTED"
    | "APPROVED"
    | "CHAIN_PENDING"
    | "CHAIN_SUBMITTED"
    | "PUBLISHED"
    | "CHAIN_FAILED"
    | "ARCHIVED";
  lastSavedAt: string;
  submittedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface DraftVersion {
  id: string;
  draftId: string;
  versionNumber: number;
  title: string;
  content: string;
  contentFormat?: "PLAINTEXT" | "MARKDOWN";
  createdAt: string;
}

const DRAFTS_QUERY_KEY = ["drafts"] as const;

/** Keep the list and the open editor in sync as soon as a draft mutation succeeds. */
function syncDraftInCache(queryClient: QueryClient, draft: Draft) {
  queryClient.setQueryData<Draft[]>(DRAFTS_QUERY_KEY, (current = []) => {
    const exists = current.some((item) => item.id === draft.id);
    return exists
      ? current.map((item) => (item.id === draft.id ? draft : item))
      : [draft, ...current];
  });
  queryClient.setQueryData(["drafts", draft.id], draft);
  void queryClient.invalidateQueries({ queryKey: DRAFTS_QUERY_KEY });
}

function removeDraftFromCache(queryClient: QueryClient, id: string) {
  queryClient.setQueryData<Draft[]>(DRAFTS_QUERY_KEY, (current = []) => current.filter((item) => item.id !== id));
  queryClient.removeQueries({ queryKey: ["drafts", id] });
  void queryClient.invalidateQueries({ queryKey: DRAFTS_QUERY_KEY });
}

export function useDrafts() {
  return useQuery({
    queryKey: DRAFTS_QUERY_KEY,
    queryFn: () => apiFetch<Draft[]>("/drafts"),
    refetchInterval: 15_000,
  });
}

export function useDraft(id: string | undefined) {
  return useQuery({
    queryKey: ["drafts", id],
    queryFn: () => apiFetch<Draft>(`/drafts/${id}`),
    enabled: !!id,
  });
}

export function useCreateDraft() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: UpdateDraftInput = {}) => apiFetch<Draft>("/drafts", { method: "POST", body: input }),
    onSuccess: (draft) => syncDraftInCache(queryClient, draft),
  });
}

export function useUpdateDraft(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: UpdateDraftInput) => apiFetch<Draft>(`/drafts/${id}`, { method: "PATCH", body: input }),
    onSuccess: (draft) => syncDraftInCache(queryClient, draft),
  });
}

export function useAutosaveDraft(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: AutosaveInput) =>
      apiFetch<Draft>(`/drafts/${id}/autosave`, { method: "POST", body: input }),
    onSuccess: (draft) => syncDraftInCache(queryClient, draft),
  });
}

export function useDeleteDraft() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiFetch(`/drafts/${id}`, { method: "DELETE" }),
    onSuccess: (_result, id) => removeDraftFromCache(queryClient, id),
  });
}

export function useDraftVersions(id: string | undefined) {
  return useQuery({
    queryKey: ["drafts", id, "versions"],
    queryFn: () => apiFetch<DraftVersion[]>(`/drafts/${id}/versions`),
    enabled: !!id,
  });
}

export function useRestoreDraftVersion(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (versionId: string) =>
      apiFetch<Draft>(`/drafts/${id}/versions/${versionId}/restore`, { method: "POST" }),
    onSuccess: (draft) => {
      syncDraftInCache(queryClient, draft);
      queryClient.invalidateQueries({ queryKey: ["drafts", id, "versions"] });
    },
  });
}

export function useSubmitDraft() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiFetch<Draft>(`/drafts/${id}/submit`, { method: "POST" }),
    onSuccess: (draft) => syncDraftInCache(queryClient, draft),
  });
}

export function useWithdrawDraft() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiFetch<Draft>(`/drafts/${id}/withdraw`, { method: "POST" }),
    onSuccess: (draft) => syncDraftInCache(queryClient, draft),
  });
}

export function useConfirmPublish() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      apiFetch(`/drafts/${id}/confirm-publish`, { method: "POST", body: { acknowledgeIrreversible: true } }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: DRAFTS_QUERY_KEY }),
  });
}
