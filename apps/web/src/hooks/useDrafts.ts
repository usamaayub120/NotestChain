import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { AutosaveInput, UpdateDraftInput } from "@noteschain/validation";
import { apiFetch } from "@/lib/api";

export interface Draft {
  id: string;
  title: string;
  content: string;
  tags: string[];
  identityMode: "NAMED" | "PSEUDONYMOUS" | "ANONYMOUS";
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
  createdAt: string;
}

export function useDrafts() {
  return useQuery({
    queryKey: ["drafts"],
    queryFn: () => apiFetch<Draft[]>("/drafts"),
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
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["drafts"] }),
  });
}

export function useUpdateDraft(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: UpdateDraftInput) => apiFetch<Draft>(`/drafts/${id}`, { method: "PATCH", body: input }),
    onSuccess: (draft) => {
      queryClient.setQueryData(["drafts", id], draft);
      queryClient.invalidateQueries({ queryKey: ["drafts"] });
    },
  });
}

export function useAutosaveDraft(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: AutosaveInput) =>
      apiFetch<Draft>(`/drafts/${id}/autosave`, { method: "POST", body: input }),
    onSuccess: (draft) => queryClient.setQueryData(["drafts", id], draft),
  });
}

export function useDeleteDraft() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiFetch(`/drafts/${id}`, { method: "DELETE" }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["drafts"] }),
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
      queryClient.setQueryData(["drafts", id], draft);
      queryClient.invalidateQueries({ queryKey: ["drafts", id, "versions"] });
    },
  });
}

export function useSubmitDraft() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiFetch<Draft>(`/drafts/${id}/submit`, { method: "POST" }),
    onSuccess: (draft) => {
      queryClient.setQueryData(["drafts", draft.id], draft);
      queryClient.invalidateQueries({ queryKey: ["drafts"] });
    },
  });
}

export function useWithdrawDraft() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiFetch<Draft>(`/drafts/${id}/withdraw`, { method: "POST" }),
    onSuccess: (draft) => {
      queryClient.setQueryData(["drafts", draft.id], draft);
      queryClient.invalidateQueries({ queryKey: ["drafts"] });
    },
  });
}

export function useConfirmPublish() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      apiFetch(`/drafts/${id}/confirm-publish`, { method: "POST", body: { acknowledgeIrreversible: true } }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["drafts"] }),
  });
}
