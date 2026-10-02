import { AlertCircle, CheckCircle2, Clock, Loader2 } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * A publishing-queue status an operator can read at a glance.
 *
 * Every status used to render in the same neutral `bg-muted` chip carrying
 * its raw enum name, so FAILED and PROCESSED were visually identical in a
 * list whose entire purpose is spotting the failures. §14 asks for colour, an
 * icon and a text label together; this is the one place in the app where all
 * three genuinely earn their keep.
 *
 * These are `OutboxStatus` values (the worker queue), not `ChainStatus` -
 * /admin/blockchain filters on PENDING / PROCESSING / PROCESSED / FAILED.
 */
type Tone = "neutral" | "progress" | "done" | "problem";

const TONE: Record<Tone, string> = {
  neutral: "bg-muted text-muted-foreground",
  progress: "bg-muted text-foreground",
  done: "bg-verified/15 text-verified",
  problem: "bg-destructive/15 text-destructive",
};

const STATUSES: Record<string, { label: string; tone: Tone; icon: LucideIcon; spin?: boolean }> = {
  PENDING: { label: "Pending", tone: "neutral", icon: Clock },
  PROCESSING: { label: "Processing", tone: "progress", icon: Loader2, spin: true },
  PROCESSED: { label: "Processed", tone: "done", icon: CheckCircle2 },
  FAILED: { label: "Failed", tone: "problem", icon: AlertCircle },
};

export function JobStatusChip({ status }: { status: string }) {
  const entry = STATUSES[status];
  // An unmapped status still has to say something truthful rather than
  // nothing, so fall back to the raw value.
  const label = entry?.label ?? status;
  const Icon = entry?.icon ?? Clock;

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium",
        TONE[entry?.tone ?? "neutral"],
      )}
    >
      <Icon size={13} strokeWidth={2} aria-hidden className={cn(entry?.spin && "motion-safe:animate-spin")} />
      {label}
    </span>
  );
}
