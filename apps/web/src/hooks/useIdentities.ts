import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { CreateIdentityInput, UpdateIdentityInput } from "@noteschain/validation";
import { apiFetch } from "@/lib/api";

export interface Identity {
  id: string;
  type: "REAL_NAME" | "PSEUDONYM";
  username: string;
  displayName: string;
  bio: string;
  avatarUrl: string | null;
  links: string[];
  isVisible: boolean;
  createdAt: string;
  updatedAt: string;
}

export function useIdentities() {
  return useQuery({
    queryKey: ["identities"],
    queryFn: () => apiFetch<Identity[]>("/identities"),
  });
}

export function useCreateIdentity() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateIdentityInput) => apiFetch<Identity>("/identities", { method: "POST", body: input }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["identities"] }),
  });
}

export function useUpdateIdentity(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: UpdateIdentityInput) =>
      apiFetch<Identity>(`/identities/${id}`, { method: "PATCH", body: input }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["identities"] }),
  });
}

export function useDeleteIdentity() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiFetch(`/identities/${id}`, { method: "DELETE" }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["identities"] }),
  });
}
