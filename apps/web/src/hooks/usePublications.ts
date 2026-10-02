import { useQuery } from "@tanstack/react-query";
import type { IdentityMode } from "@noteschain/shared";
import { apiFetch, apiFetchPaginated } from "@/lib/api";

export interface PublicationAuthor {
  username: string;
  displayName: string;
  avatarUrl: string | null;
  type: "REAL_NAME" | "PSEUDONYM";
  /** True for the author's own Keeper profile, false for a pen name. */
  isPrimary: boolean;
}

export interface PublicationChain {
  status: string;
  network: string;
  publicationPda: string | null;
  transactionSignature: string | null;
  slot: number | null;
  explorerUrl: string | null;
}

export interface Publication {
  id: string;
  title: string;
  content: string;
  contentFormat?: "PLAINTEXT" | "MARKDOWN";
  excerpt: string;
  tags: string[];
  identityMode: IdentityMode;
  discoverability: "PUBLIC" | "UNLISTED";
  author: PublicationAuthor | null;
  status: string;
  previousPublicationId: string | null;
  publishedAt: string | null;
  createdAt: string;
  commentsEnabled: boolean;
  viewerIsOwner: boolean;
  chain: PublicationChain | null;
  highlight?: string | null;
}

interface Paginated<T> {
  data: T[];
  meta: { page: number; pageSize: number; total: number };
}

/**
 * Routed through the shared client rather than a second, private `fetch`.
 * The hand-rolled version bypassed every guarantee lib/api.ts provides: it
 * never produced an ApiClientError (so no status, code or field details), it
 * never produced an ApiNetworkError (so ErrorState could not tell a dropped
 * connection from a server fault), and `res.json()` threw a raw SyntaxError
 * whenever the failure response wasn't JSON -  which is exactly what happens
 * when the API is down and the dev proxy answers instead.
 */
async function fetchPaginated<T>(path: string): Promise<Paginated<T>> {
  return apiFetchPaginated<T>(path);
}

export function useExplorePublications(page = 1, tag?: string) {
  const params = new URLSearchParams({ page: String(page) });
  if (tag) params.set("tag", tag);
  return useQuery({
    queryKey: ["publications", "explore", page, tag],
    queryFn: () => fetchPaginated<Publication>(`/publications?${params.toString()}`),
  });
}

/** The home feed's Following tab. Requires a session; see the API's 401 when signed out. */
export function useFollowingPublications(page = 1, enabled = true) {
  return useQuery({
    queryKey: ["publications", "following", page],
    queryFn: () => fetchPaginated<Publication>(`/publications?feed=following&page=${page}`),
    enabled,
  });
}

export function usePublication(id: string | undefined) {
  return useQuery({
    queryKey: ["publications", id],
    queryFn: () => apiFetch<Publication>(`/publications/${id}`),
    enabled: !!id,
  });
}

export interface OnChainOnlyResult {
  publicationId: string;
  pda: string;
  schemaVersion: 1 | 2;
  title: string;
  authorDisplaySnapshot: string;
  publishedAt: number;
  content: string | null;
  excerpt: string | null;
  contentHash: string;
  explorerUrl: string;
}

export type ProofLookupResult =
  | { kind: "publication"; publication: Publication }
  | { kind: "onchain_only"; account: OnChainOnlyResult }
  | { kind: "not_found" };

/** Enabled only once a query has actually been submitted -  see VerifyNotePage. */
export function useProofLookup(query: string, enabled: boolean) {
  return useQuery({
    queryKey: ["publications", "lookup", query],
    queryFn: () => apiFetch<ProofLookupResult>(`/publications/lookup?q=${encodeURIComponent(query)}`),
    enabled,
    retry: false,
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
