import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";

export interface PublicationAuthor {
  username: string;
  displayName: string;
  avatarUrl: string | null;
  type: "REAL_NAME" | "PSEUDONYM";
}

export interface PublicationChain {
  status: string;
  network: string;
  publicationPda: string | null;
  transactionSignature: string | null;
  explorerUrl: string | null;
}

export interface Publication {
  id: string;
  title: string;
  content: string;
  excerpt: string;
  tags: string[];
  identityMode: "NAMED" | "PSEUDONYMOUS" | "ANONYMOUS";
  discoverability: "PUBLIC" | "UNLISTED";
  author: PublicationAuthor | null;
  status: string;
  previousPublicationId: string | null;
  publishedAt: string | null;
  createdAt: string;
  chain: PublicationChain | null;
  highlight?: string | null;
}

interface Paginated<T> {
  data: T[];
  meta: { page: number; pageSize: number; total: number };
}

async function fetchPaginated<T>(path: string): Promise<Paginated<T>> {
  const res = await fetch(`/api/v1${path}`, { credentials: "include" });
  const payload = await res.json();
  if (!res.ok) throw new Error(payload?.error?.message ?? "Request failed");
  return payload;
}

export function useExplorePublications(page = 1, tag?: string) {
  const params = new URLSearchParams({ page: String(page) });
  if (tag) params.set("tag", tag);
  return useQuery({
    queryKey: ["publications", "explore", page, tag],
    queryFn: () => fetchPaginated<Publication>(`/publications?${params.toString()}`),
  });
}

export function usePublication(id: string | undefined) {
  return useQuery({
    queryKey: ["publications", id],
    queryFn: () => apiFetch<Publication>(`/publications/${id}`),
    enabled: !!id,
  });
}

export function usePublicationRevisions(id: string | undefined) {
  return useQuery({
    queryKey: ["publications", id, "revisions"],
    queryFn: () => apiFetch<{ previous: Publication | null; revisions: Publication[] }>(`/publications/${id}/revisions`),
    enabled: !!id,
  });
}

export interface VerificationResult {
  state: string;
  message: string;
  checkedAt: string;
}

export function usePublicationVerification(id: string | undefined) {
  return useQuery({
    queryKey: ["publications", id, "verify"],
    queryFn: () => apiFetch<VerificationResult>(`/publications/${id}/verify`),
    enabled: !!id,
    staleTime: 60_000,
  });
}
