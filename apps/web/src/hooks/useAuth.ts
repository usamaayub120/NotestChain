import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { RegisterInput } from "@noteschain/validation";
import { apiFetch } from "@/lib/api";

export interface PrimaryIdentitySummary {
  username: string;
  displayName: string;
  avatarUrl: string | null;
  /** Null when the handle was generated (the backfill, or an old client that
   * registered without one) and the one free rename is still owed. */
  canChangeUsername: boolean;
}

export interface PublicUser {
  id: string;
  email: string;
  role: "USER" | "MODERATOR" | "ADMIN";
  roles: Array<"MODERATOR" | "CAMPAIGN_CREATOR" | "CAMPAIGN_APPROVER" | "PLATFORM_ADMIN" | "ACCESS_MANAGER" | "OWNER">;
  status: string;
  createdAt: string;
  commentDisplayName: string | null;
  /** The Keeper profile created alongside this account. */
  primaryIdentity: PrimaryIdentitySummary | null;
}

export function useCurrentUser() {
  return useQuery({
    queryKey: ["auth", "me"],
    queryFn: () => apiFetch<{ user: PublicUser }>("/auth/me").then((d) => d.user),
    retry: false,
  });
}

export function useLogin() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { email: string; password: string }) =>
      apiFetch<{ user: PublicUser }>("/auth/login", { method: "POST", body: input }),
    onSuccess: (data) => queryClient.setQueryData(["auth", "me"], data.user),
  });
}

export function useRegister() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: RegisterInput) =>
      apiFetch<{ user: PublicUser }>("/auth/register", { method: "POST", body: input }),
    onSuccess: (data) => queryClient.setQueryData(["auth", "me"], data.user),
  });
}

export function useLogout() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => apiFetch("/auth/logout", { method: "POST" }),
    onSuccess: () => queryClient.setQueryData(["auth", "me"], null),
  });
}

export function useDeleteAccount() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { password: string }) =>
      apiFetch<{ success: boolean }>("/auth/account", { method: "DELETE", body: input }),
    onSuccess: () => queryClient.setQueryData(["auth", "me"], null),
  });
}

export function useForgotPassword() {
  return useMutation({
    mutationFn: (input: { email: string }) =>
      apiFetch<{ message: string }>("/auth/forgot-password", { method: "POST", body: input }),
  });
}

export function useResetPassword() {
  return useMutation({
    mutationFn: (input: { token: string; password: string }) =>
      apiFetch<{ success: boolean }>("/auth/reset-password", { method: "POST", body: input }),
  });
}
