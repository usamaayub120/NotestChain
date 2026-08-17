import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";

export interface SubmissionSummary {
  id: string;
  draftId: string;
  submittedByUserId: string;
  titleSnapshot: string;
  contentSnapshot: string;
  contentFormatSnapshot?: "PLAINTEXT" | "MARKDOWN";
  tagsSnapshot: string[];
  identityModeSnapshot: string;
  discoverabilitySnapshot: string;
  status: string;
  createdAt: string;
  decidedAt: string | null;
  submittedBy: { id: string; email: string; status: string; createdAt: string };
}

export interface SubmissionDetail {
  submission: SubmissionSummary & {
    decisions: Array<{
      id: string;
      action: string;
      reason: string;
      note: string | null;
      flaggedPii: boolean;
      flaggedAbuse: boolean;
      createdAt: string;
      moderator: { id: string; email: string };
    }>;
  };
  priorSubmissions: SubmissionSummary[];
  possibleDuplicates: Array<{ id: string; draftId: string; submittedByUserId: string; createdAt: string; status: string }>;
}

export function usePendingSubmissions() {
  return useQuery({
    queryKey: ["moderation", "submissions"],
    queryFn: () => apiFetch<SubmissionSummary[]>("/moderation/submissions"),
  });
}

export function useSubmissionDetail(id: string | undefined) {
  return useQuery({
    queryKey: ["moderation", "submissions", id],
    queryFn: () => apiFetch<SubmissionDetail>(`/moderation/submissions/${id}`),
    enabled: !!id,
  });
}

interface DecisionInput {
  reason: string;
  note?: string;
  flaggedPii?: boolean;
  flaggedAbuse?: boolean;
}

function useDecision(action: "approve" | "reject" | "request-changes") {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: DecisionInput }) =>
      apiFetch(`/moderation/submissions/${id}/${action}`, { method: "POST", body: input }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["moderation"] }),
  });
}

export const useApproveSubmission = () => useDecision("approve");
export const useRejectSubmission = () => useDecision("reject");
export const useRequestChangesSubmission = () => useDecision("request-changes");
