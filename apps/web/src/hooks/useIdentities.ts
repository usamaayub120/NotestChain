import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { ChangeUsernameInput, CreateIdentityInput, UpdateIdentityInput } from "@noteschain/validation";
import { apiFetch } from "@/lib/api";

export interface Identity {
  id: string;
  type: "REAL_NAME" | "PSEUDONYM";
  /** The Keeper profile — every account has exactly one, and it's this one. */
  isPrimary: boolean;
  username: string;
  displayName: string;
  bio: string;
  avatarUrl: string | null;
  links: string[];
  location: string | null;
  pronouns: string | null;
  /** This is the owner's own view — the private value is returned whether or not showBirthDate is on; the public profile applies that gate itself. */
  birthDate: string | null;
  showBirthDate: boolean;
  gender: string | null;
  showGender: boolean;
  /** Only meaningful on the Keeper profile: true once the one free rename is still available. */
  canChangeUsername: boolean;
  isVisible: boolean;
  createdAt: string;
  updatedAt: string;
}

/** Keeper profile first, then pen names — matches the API's ordering. */
export function useIdentities() {
  return useQuery({
    queryKey: ["identities"],
    queryFn: () => apiFetch<Identity[]>("/identities"),
  });
}

export function useKeeperProfile() {
  const { data: identities } = useIdentities();
  return identities?.find((identity) => identity.isPrimary);
}

export function usePenNames() {
  const { data: identities } = useIdentities();
  return identities?.filter((identity) => !identity.isPrimary);
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

/** The one free rename on the Keeper profile — see canChangeUsername on Identity. */
export function useChangeKeeperUsername() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: ChangeUsernameInput) =>
      apiFetch<Identity>("/identities/me/username", { method: "POST", body: input }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["identities"] });
      queryClient.invalidateQueries({ queryKey: ["auth", "me"] });
    },
  });
}
