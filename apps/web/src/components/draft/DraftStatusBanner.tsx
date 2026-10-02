import { AlertCircle, CheckCircle2, Clock, Loader2, MessageSquareQuote } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Link } from "react-router-dom";
import type { Draft } from "@/hooks/useDrafts";
import { cn } from "@/lib/utils";

/**
 * What the editor says about a draft it can't simply be typed into.
 *
 * The block this replaces covered four of the ten statuses and rendered an
 * empty padded rectangle for the rest, including every chain state. It also
 * gated itself on `!editable`, and CHANGES_REQUESTED is editable -  so the one
 * status that exists specifically to ask the author for something showed them
 * nothing at all.
 */

type Tone = "info" | "progress" | "attention" | "problem" | "done";

const TONE_STYLES: Record<Tone, { box: string; icon: string }> = {
  info: { box: "border-border bg-muted/60", icon: "text-muted-foreground" },
  progress: { box: "border-border bg-muted/60", icon: "text-muted-foreground" },
  attention: { box: "border-warning/40 bg-warning/10", icon: "text-warning" },
  problem: { box: "border-destructive/40 bg-destructive/10", icon: "text-destructive" },
  done: { box: "border-verified/40 bg-verified/10", icon: "text-verified" },
};

function Banner({
  tone,
  icon: Icon,
  spin,
  title,
  children,
}: {
  tone: Tone;
  icon: LucideIcon;
  spin?: boolean;
  title: string;
  children?: React.ReactNode;
}) {
  const styles = TONE_STYLES[tone];
  return (
    <div className={cn("mt-3 flex items-start gap-3 rounded-md border px-3 py-3 text-sm", styles.box)} role="status">
      <Icon
        size={18}
        strokeWidth={1.75}
        aria-hidden
        className={cn("mt-0.5 shrink-0", styles.icon, spin && "motion-safe:animate-spin")}
      />
      <div className="min-w-0 flex-1">
        <p className="font-medium">{title}</p>
        {children}
      </div>
    </div>
  );
}

/** The moderator's own words, quoted rather than paraphrased. */
function ModeratorReason({ reason }: { reason: string }) {
  return (
    <blockquote className="mt-2 border-l border-border pl-3 text-muted-foreground">{reason}</blockquote>
  );
}

export function DraftStatusBanner({ draft }: { draft: Draft }) {
  const reason = draft.moderation?.reason;

  switch (draft.status) {
    case "CHANGES_REQUESTED":
      return (
        <Banner tone="attention" icon={MessageSquareQuote} title="A moderator asked for changes">
          {reason ? <ModeratorReason reason={reason} /> : null}
          <p className="mt-2 text-muted-foreground">Edit below and submit it again when you're ready.</p>
        </Banner>
      );

    case "REJECTED":
      return (
        <Banner tone="problem" icon={AlertCircle} title="This submission was rejected">
          {reason ? <ModeratorReason reason={reason} /> : null}
          <p className="mt-2 text-muted-foreground">
            It stays here, and you can{" "}
            <Link to="/drafts" className="text-primary underline underline-offset-2">
              start something new
            </Link>{" "}
            whenever you like.
          </p>
        </Banner>
      );

    case "PENDING_REVIEW":
      return (
        <Banner tone="info" icon={Clock} title="Awaiting moderator review">
          <p className="mt-1 text-muted-foreground">You can withdraw it below.</p>
        </Banner>
      );

    case "APPROVED":
      return (
        <Banner tone="done" icon={CheckCircle2} title="Approved">
          <p className="mt-1 text-muted-foreground">Publish it permanently when you're ready.</p>
        </Banner>
      );

    // The four states that used to render a padded empty box.
    case "CHAIN_PENDING":
      return (
        <Banner tone="progress" icon={Loader2} spin title="Publishing">
          <p className="mt-1 text-muted-foreground">This note is on its way to the public record.</p>
        </Banner>
      );

    case "CHAIN_SUBMITTED":
      return (
        <Banner tone="progress" icon={Loader2} spin title="Publishing">
          <p className="mt-1 text-muted-foreground">
            It's been sent. We're waiting for the record to settle, which usually takes a moment.
          </p>
        </Banner>
      );

    case "CHAIN_FAILED":
      return (
        <Banner tone="problem" icon={AlertCircle} title="Publishing didn't finish">
          <p className="mt-1 text-muted-foreground">
            Nothing was lost. Your note is still here and we're retrying it. If it hasn't moved by tomorrow,
            email{" "}
            <a href="mailto:support@noteschain.org" className="text-primary underline underline-offset-2">
              support@noteschain.org
            </a>{" "}
            and we'll look into it.
          </p>
        </Banner>
      );

    case "PUBLISHED":
      return (
        <Banner tone="done" icon={CheckCircle2} title="This note is kept">
          <p className="mt-1 text-muted-foreground">It's part of the public record now and can't be edited.</p>
        </Banner>
      );

    case "ARCHIVED":
      return (
        <Banner tone="info" icon={Clock} title="This draft is archived">
          <p className="mt-1 text-muted-foreground">It isn't in your active drafts.</p>
        </Banner>
      );

    case "DRAFT":
    default:
      return null;
  }
}
