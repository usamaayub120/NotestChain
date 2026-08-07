import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";

export interface PublicUser {
  id: string;
  email: string;
  role: "USER" | "MODERATOR" | "ADMIN";
  status: string;
  createdAt: string;
  commentDisplayName: string | null;
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
    mutationFn: (input: { email: string; password: string }) =>
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
