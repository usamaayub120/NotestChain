import { useState } from "react";
import { Link } from "react-router-dom";
import {
  useCommentReports,
  useReports,
  useResolveCommentReport,
  useResolveReport,
  useRestorePublicationListing,
  type AdminCommentReport,
  type AdminReport,
} from "@/hooks/useAdmin";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { EmptyState } from "@/components/EmptyState";
import { CardSkeletonList } from "@/components/CardSkeleton";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { ConfirmActionDialog } from "@/components/ConfirmActionDialog";
import { MutationError } from "@/components/admin/MutationError";

const DESTRUCTIVE_REPORT_ACTION_COPY = {
  DELISTED: {
    title: "Delist this publication?",
    description: "It will no longer be publicly visible on NotesChain. This does not remove it from the blockchain record.",
    confirmLabel: "Delist publication",
    pendingLabel: "Delisting…",
  },
  USER_SUSPENDED: {
    title: "Suspend this author?",
    description: "They will lose access to their account until reinstated. Do this only for a clear, reviewed violation.",
    confirmLabel: "Suspend author",
    pendingLabel: "Suspending…",
  },
} as const;

function OpenReportRow({ report }: { report: AdminReport }) {
  const [note, setNote] = useState("");
  const [confirmAction, setConfirmAction] = useState<"DELISTED" | "USER_SUSPENDED" | null>(null);
  const resolve = useResolveReport();

  function resolveAs(action: "DISMISSED" | "DELISTED" | "USER_SUSPENDED") {
    resolve.mutate(
      { id: report.id, input: { action, resolutionNote: note || undefined } },
      { onSuccess: () => setConfirmAction(null) },
    );
  }

  return (
    <li className="rounded-md border border-border bg-surface p-4">
      <ReportHeader report={report} />
      <p className="mt-3 text-sm">{report.reason}</p>

      <div className="mt-4 space-y-2 border-t border-border pt-3">
        <Textarea
          placeholder="Resolution note (optional, internal)"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          rows={2}
        />
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" disabled={resolve.isPending} onClick={() => resolveAs("DISMISSED")}>
            Dismiss
          </Button>
          <Button variant="destructive" disabled={resolve.isPending} onClick={() => setConfirmAction("DELISTED")}>
            Delist publication
          </Button>
          <Button variant="destructive" disabled={resolve.isPending} onClick={() => setConfirmAction("USER_SUSPENDED")}>
            Suspend author
          </Button>
        </div>
        <MutationError error={resolve.isError ? resolve.error : null} />
      </div>

      {confirmAction && (
        <ConfirmActionDialog
          open
          onOpenChange={(next) => !next && setConfirmAction(null)}
          isPending={resolve.isPending}
          onConfirm={() => resolveAs(confirmAction)}
          {...DESTRUCTIVE_REPORT_ACTION_COPY[confirmAction]}
        />
      )}
    </li>
  );
}

function ResolvedReportRow({ report }: { report: AdminReport }) {
  const restore = useRestorePublicationListing();
  const canRestore = report.resolution === "DELISTED" && report.publication && !report.publication.isPlatformVisible;

  return (
    <li className="rounded-md border border-border bg-surface p-4">
      <ReportHeader report={report} />
      <p className="mt-3 text-sm">{report.reason}</p>
      <p className="mt-3 text-sm text-muted-foreground">
        Resolved as <span className="font-medium text-foreground">{report.resolution}</span>
        {report.resolutionNote && ` — ${report.resolutionNote}`}
      </p>
      {canRestore && (
        <Button
          variant="outline"
          className="mt-3"
          disabled={restore.isPending}
          onClick={() => restore.mutate({ id: report.publicationId })}
        >
          Restore listing
        </Button>
      )}
      <MutationError error={restore.isError ? restore.error : null} />
    </li>
  );
}

function ReportHeader({ report }: { report: AdminReport }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <div>
        <Link to={`/p/${report.publicationId}`} className="font-medium text-primary underline">
          {report.publication?.title ?? report.publicationId}
        </Link>
        <p className="mt-1 text-xs text-muted-foreground">
          reported by {report.reporter?.email ?? "an anonymous session"} · {new Date(report.createdAt).toLocaleString()}
        </p>
      </div>
      {report.publication && !report.publication.isPlatformVisible && (
        <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">delisted</span>
      )}
    </div>
  );
}

const DESTRUCTIVE_COMMENT_ACTION_COPY = {
  COMMENT_REMOVED: {
    title: "Remove this comment?",
    description: "It will no longer be visible to readers. This does not remove it from the blockchain record.",
    confirmLabel: "Remove comment",
    pendingLabel: "Removing…",
  },
  USER_SUSPENDED: {
    title: "Suspend this author?",
    description: "They will lose access to their account until reinstated. Do this only for a clear, reviewed violation.",
    confirmLabel: "Suspend author",
    pendingLabel: "Suspending…",
  },
} as const;

function OpenCommentReportRow({ report }: { report: AdminCommentReport }) {
  const [note, setNote] = useState("");
  const [confirmAction, setConfirmAction] = useState<"COMMENT_REMOVED" | "USER_SUSPENDED" | null>(null);
  const resolve = useResolveCommentReport();

  function resolveAs(action: "DISMISSED" | "COMMENT_REMOVED" | "USER_SUSPENDED") {
    resolve.mutate(
      { id: report.id, input: { action, resolutionNote: note || undefined } },
      { onSuccess: () => setConfirmAction(null) },
    );
  }

  return (
    <li className="rounded-md border border-border bg-surface p-4">
      <CommentReportHeader report={report} />
      <p className="mt-3 text-sm">{report.reason}</p>

      <div className="mt-4 space-y-2 border-t border-border pt-3">
        <Textarea
          placeholder="Resolution note (optional, internal)"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          rows={2}
        />
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" disabled={resolve.isPending} onClick={() => resolveAs("DISMISSED")}>
            Dismiss
          </Button>
          <Button variant="destructive" disabled={resolve.isPending} onClick={() => setConfirmAction("COMMENT_REMOVED")}>
            Remove comment
          </Button>
          <Button variant="destructive" disabled={resolve.isPending} onClick={() => setConfirmAction("USER_SUSPENDED")}>
            Suspend author
          </Button>
        </div>
        <MutationError error={resolve.isError ? resolve.error : null} />
      </div>

      {confirmAction && (
        <ConfirmActionDialog
          open
          onOpenChange={(next) => !next && setConfirmAction(null)}
          isPending={resolve.isPending}
          onConfirm={() => resolveAs(confirmAction)}
          {...DESTRUCTIVE_COMMENT_ACTION_COPY[confirmAction]}
        />
      )}
    </li>
  );
}

function ResolvedCommentReportRow({ report }: { report: AdminCommentReport }) {
  return (
    <li className="rounded-md border border-border bg-surface p-4">
      <CommentReportHeader report={report} />
      <p className="mt-3 text-sm">{report.reason}</p>
      <p className="mt-3 text-sm text-muted-foreground">
        Resolved as <span className="font-medium text-foreground">{report.resolution}</span>
        {report.resolutionNote && ` — ${report.resolutionNote}`}
      </p>
    </li>
  );
}

function CommentReportHeader({ report }: { report: AdminCommentReport }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <div>
        <Link to={`/p/${report.comment?.publicationId ?? ""}`} className="font-medium text-primary underline">
          {report.comment?.body ? truncate(report.comment.body) : report.commentId}
        </Link>
        <p className="mt-1 text-xs text-muted-foreground">
          reported by {report.reporter?.email ?? "an anonymous session"} · {new Date(report.createdAt).toLocaleString()}
        </p>
      </div>
      {report.comment && !report.comment.isVisible && (
        <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">removed</span>
      )}
    </div>
  );
}

function truncate(text: string, max = 80): string {
  return text.length > max ? `${text.slice(0, max)}…` : text;
}

export function ReportsQueuePage() {
  const [contentType, setContentType] = useState<"publications" | "comments">("publications");
  const [status, setStatus] = useState<"OPEN" | "RESOLVED">("OPEN");
  const { data: reports, isLoading: isLoadingReports } = useReports(status);
  const { data: commentReports, isLoading: isLoadingCommentReports } = useCommentReports(status);

  const isLoading = contentType === "publications" ? isLoadingReports : isLoadingCommentReports;
  const isEmpty =
    contentType === "publications" ? !isLoading && reports?.length === 0 : !isLoading && commentReports?.length === 0;

  return (
    <div className="mx-auto max-w-2xl px-4 py-6">
      <AdminPageHeader title="Reports" description="Reader reports, newest first." />

      <Tabs value={contentType} onValueChange={(v) => setContentType(v as "publications" | "comments")} className="mt-4">
        <TabsList>
          <TabsTrigger value="publications">Publications</TabsTrigger>
          <TabsTrigger value="comments">Comments</TabsTrigger>
        </TabsList>
      </Tabs>

      <Tabs value={status} onValueChange={(v) => setStatus(v as "OPEN" | "RESOLVED")} className="mt-2">
        <TabsList>
          <TabsTrigger value="OPEN">Open</TabsTrigger>
          <TabsTrigger value="RESOLVED">Resolved</TabsTrigger>
        </TabsList>
      </Tabs>

      {isLoading && <div className="mt-6"><CardSkeletonList /></div>}
      {isEmpty && (
        <EmptyState
          title={status === "OPEN" ? "No open reports" : "Nothing resolved yet"}
          description={status === "OPEN" ? "Everything reported so far has been resolved." : undefined}
        />
      )}

      <ul className="mt-6 space-y-3">
        {contentType === "publications"
          ? reports?.map((report) =>
              status === "OPEN" ? (
                <OpenReportRow key={report.id} report={report} />
              ) : (
                <ResolvedReportRow key={report.id} report={report} />
              ),
            )
          : commentReports?.map((report) =>
              status === "OPEN" ? (
                <OpenCommentReportRow key={report.id} report={report} />
              ) : (
                <ResolvedCommentReportRow key={report.id} report={report} />
              ),
            )}
      </ul>
    </div>
  );
}
