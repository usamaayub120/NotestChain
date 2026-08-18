import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiFetch, apiFetchPaginated } from "@/lib/api";

export interface AdminQuery { page: number; pageSize: number; from?: string; to?: string; }
function queryString(query: AdminQuery, extra: Record<string, string | undefined> = {}) {
  const params = new URLSearchParams({ page: String(query.page), pageSize: String(query.pageSize) });
  if (query.from) params.set("from", query.from);
  if (query.to) params.set("to", query.to);
  Object.entries(extra).forEach(([key, value]) => { if (value) params.set(key, value); });
  return params.toString();
}

export interface AdminReport {
  id: string;
  publicationId: string;
  reporterUserId: string | null;
  reason: string;
  status: "OPEN" | "RESOLVED";
  resolution: "DISMISSED" | "DELISTED" | "USER_SUSPENDED" | null;
  resolutionNote: string | null;
  resolvedAt: string | null;
  createdAt: string;
  publication: { id: string; title: string; isPlatformVisible: boolean } | null;
  reporter: { id: string; email: string } | null;
}

export function useReports(status: "OPEN" | "RESOLVED", query: AdminQuery) {
  return useQuery({
    queryKey: ["admin", "reports", status, query],
    queryFn: () => apiFetchPaginated<AdminReport>(`/admin/reports?${queryString(query, { status })}`),
  });
}

interface ResolveReportInput {
  action: "DISMISSED" | "DELISTED" | "USER_SUSPENDED";
  resolutionNote?: string;
}

export function useResolveReport() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: ResolveReportInput }) =>
      apiFetch(`/admin/reports/${id}/resolve`, { method: "POST", body: input }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["admin", "reports"] }),
  });
}

export interface AdminCommentReport {
  id: string;
  commentId: string;
  reporterUserId: string | null;
  reason: string;
  status: "OPEN" | "RESOLVED";
  resolution: "DISMISSED" | "COMMENT_REMOVED" | "USER_SUSPENDED" | null;
  resolutionNote: string | null;
  resolvedAt: string | null;
  createdAt: string;
  comment: { id: string; body: string; isVisible: boolean; publicationId: string } | null;
  reporter: { id: string; email: string } | null;
}

export function useCommentReports(status: "OPEN" | "RESOLVED", query: AdminQuery) {
  return useQuery({
    queryKey: ["admin", "comment-reports", status, query],
    queryFn: () => apiFetchPaginated<AdminCommentReport>(`/admin/comment-reports?${queryString(query, { status })}`),
  });
}

interface ResolveCommentReportInput {
  action: "DISMISSED" | "COMMENT_REMOVED" | "USER_SUSPENDED";
  resolutionNote?: string;
}

export function useResolveCommentReport() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: ResolveCommentReportInput }) =>
      apiFetch(`/admin/comment-reports/${id}/resolve`, { method: "POST", body: input }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["admin", "comment-reports"] }),
  });
}

export function useRestorePublicationListing() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id }: { id: string }) => apiFetch(`/admin/publications/${id}/restore-listing`, { method: "POST" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "reports"] });
      queryClient.invalidateQueries({ queryKey: ["publications"] });
    },
  });
}

export interface AuditLogEntry {
  id: string;
  actorUserId: string | null;
  action: string;
  targetType: string | null;
  targetId: string | null;
  metadata: Record<string, unknown> | null;
  ipAddress: string | null;
  createdAt: string;
  actor: { id: string; email: string } | null;
}

export function useAuditLog(query: AdminQuery) {
  return useQuery({
    queryKey: ["admin", "audit-log", query],
    queryFn: () => apiFetchPaginated<AuditLogEntry>(`/admin/audit-log?${queryString(query)}`),
  });
}

export interface BlockchainJob {
  id: string;
  kind: string;
  publicationId: string;
  status: "PENDING" | "PROCESSING" | "PROCESSED" | "FAILED";
  attempts: number;
  maxAttempts: number;
  nextAttemptAt: string;
  lastError: string | null;
  createdAt: string;
  updatedAt: string;
  publication: {
    id: string;
    title: string;
    status: string;
    chainRecord: { chainStatus: string; lastError: string | null } | null;
  } | null;
}

export function useBlockchainJobs(query: AdminQuery, status?: BlockchainJob["status"]) {
  return useQuery({
    queryKey: ["admin", "blockchain-jobs", query, status],
    queryFn: () => apiFetchPaginated<BlockchainJob>(`/admin/blockchain/jobs?${queryString(query, { status })}`),
  });
}

export interface ViewsBreakdown {
  total: number;
  bySource: { utmSource: string; count: number }[];
  mostViewed: {
    items: { publication: { id: string; title: string; isPlatformVisible: boolean } | null; uniqueReaders: number }[];
    total: number;
  };
}

export function useViewsBreakdown(query: AdminQuery) {
  return useQuery({
    queryKey: ["admin", "views", query],
    queryFn: () => apiFetch<ViewsBreakdown>(`/admin/views?${queryString(query)}`),
  });
}

export function useRetryBlockchainJob() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id }: { id: string }) => apiFetch(`/admin/blockchain/jobs/${id}/retry`, { method: "POST" }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["admin", "blockchain-jobs"] }),
  });
}
