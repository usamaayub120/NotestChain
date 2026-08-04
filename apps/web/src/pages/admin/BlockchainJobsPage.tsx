import { useState } from "react";
import { Link } from "react-router-dom";
import { useBlockchainJobs, useRetryBlockchainJob, type BlockchainJob } from "@/hooks/useAdmin";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { EmptyState } from "@/components/EmptyState";

const STATUS_FILTERS = ["ALL", "PENDING", "PROCESSING", "PROCESSED", "FAILED"] as const;
type StatusFilter = (typeof STATUS_FILTERS)[number];

function JobRow({ job }: { job: BlockchainJob }) {
  const retry = useRetryBlockchainJob();

  return (
    <li className="rounded-md border border-border bg-surface p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <Link to={`/p/${job.publicationId}`} className="font-medium text-primary underline">
            {job.publication?.title ?? job.publicationId}
          </Link>
          <p className="mt-1 text-xs text-muted-foreground">
            {job.kind} · attempt {job.attempts}/{job.maxAttempts} · updated {new Date(job.updatedAt).toLocaleString()}
          </p>
        </div>
        <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">{job.status}</span>
      </div>

      {job.publication?.chainRecord?.chainStatus && (
        <p className="mt-2 text-xs text-muted-foreground">chain status: {job.publication.chainRecord.chainStatus}</p>
      )}
      {job.lastError && <p className="mt-2 whitespace-pre-wrap text-xs text-destructive">{job.lastError}</p>}

      {job.status === "FAILED" && (
        <Button
          variant="outline"
          className="mt-3"
          disabled={retry.isPending}
          onClick={() => retry.mutate({ id: job.id })}
        >
          Retry
        </Button>
      )}
    </li>
  );
}

export function BlockchainJobsPage() {
  const [status, setStatus] = useState<StatusFilter>("ALL");
  const [page, setPage] = useState(1);
  const { data, isLoading } = useBlockchainJobs(page, status === "ALL" ? undefined : status);

  const totalPages = data ? Math.max(1, Math.ceil(data.meta.total / data.meta.pageSize)) : 1;

  return (
    <div className="mx-auto max-w-2xl px-4 py-6">
      <h1 className="text-2xl">Blockchain jobs</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        The publish queue — reconciliation runs automatically every few minutes and flags mismatches to the audit log.
      </p>

      <Tabs
        value={status}
        onValueChange={(v) => {
          setStatus(v as StatusFilter);
          setPage(1);
        }}
        className="mt-4"
      >
        <TabsList>
          {STATUS_FILTERS.map((s) => (
            <TabsTrigger key={s} value={s}>
              {s}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      {isLoading && <p className="mt-6 text-muted-foreground">Loading…</p>}
      {!isLoading && data?.data.length === 0 && <EmptyState title="No jobs" description="Nothing matches this filter." />}

      <ul className="mt-6 space-y-3">{data?.data.map((job) => <JobRow key={job.id} job={job} />)}</ul>

      {data && data.meta.total > data.meta.pageSize && (
        <div className="mt-6 flex items-center justify-between">
          <Button variant="outline" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
            Previous
          </Button>
          <span className="text-sm text-muted-foreground">
            Page {page} of {totalPages}
          </span>
          <Button variant="outline" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>
            Next
          </Button>
        </div>
      )}
    </div>
  );
}
