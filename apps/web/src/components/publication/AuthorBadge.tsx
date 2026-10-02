import { Link } from "react-router-dom";
import type { PublicationAuthor } from "@/hooks/usePublications";
import { useProfile } from "@/hooks/useProfile";
import { identityKindLabel, formatRelativeTime } from "@noteschain/shared";
import { FollowButton } from "./FollowButton";

// "Primary profile" is database language. DESIGN_SYSTEM.md §11/§12 both
// say "Keeper profile"; see packages/shared/src/labels.ts.

export function AuthorBadge({
  author,
  timestamp,
  linkToProfile = true,
  size = "compact",
}: {
  author: PublicationAuthor | null;
  timestamp?: string;
  /** Set false when this badge is already nested inside another link
   * (e.g. PublicationCard) -  nesting an <a> inside an <a> is invalid HTML
   * and breaks click targeting. */
  linkToProfile?: boolean;
  /**
   * "reader" is the note page's byline: large, obviously tappable, carries
   * the Keeper-profile/pen-name label and a Follow button. "compact" is
   * everywhere else (cards, comments) -  small, no label, no follow control.
   */
  size?: "compact" | "reader";
}) {
  if (!author) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-muted text-xs">?</span>
        <span className="font-medium text-foreground">Anonymous</span>
        {timestamp && <span aria-hidden="true">·</span>}
        {timestamp && <time dateTime={timestamp}>{formatRelative(timestamp)}</time>}
      </div>
    );
  }

  if (size === "reader") {
    return <ReaderByline author={author} timestamp={timestamp} />;
  }

  return (
    <div className="flex items-center gap-2 text-sm">
      <span className="flex h-6 w-6 items-center justify-center overflow-hidden rounded-full bg-muted text-xs font-medium">
        {author.avatarUrl ? (
          <img src={author.avatarUrl} alt="" className="h-full w-full object-cover" />
        ) : (
          author.displayName.slice(0, 1).toUpperCase()
        )}
      </span>
      {linkToProfile ? (
        <Link to={`/@${author.username}`} className="font-medium text-foreground hover:underline">
          {author.displayName}
        </Link>
      ) : (
        <span className="font-medium text-foreground">{author.displayName}</span>
      )}
      {timestamp && <span className="text-muted-foreground" aria-hidden="true">·</span>}
      {timestamp && (
        <time dateTime={timestamp} className="text-muted-foreground">
          {formatRelative(timestamp)}
        </time>
      )}
    </div>
  );
}

/**
 * The note page's byline -  big enough to obviously be a link, and the one
 * place besides the profile page itself that a reader can follow a byline
 * without leaving what they're reading. isFollowing needs a live profile
 * fetch (the publication DTO doesn't carry per-viewer follow state), so this
 * one extra request is scoped to just this variant.
 */
function ReaderByline({ author, timestamp }: { author: PublicationAuthor; timestamp?: string }) {
  const { data: profile } = useProfile(author.username);

  return (
    <div className="flex items-center gap-3">
      <Link to={`/@${author.username}`} className="flex shrink-0 items-center gap-3 group">
        <span className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-full bg-muted text-base font-medium">
          {author.avatarUrl ? (
            <img src={author.avatarUrl} alt="" className="h-full w-full object-cover" />
          ) : (
            author.displayName.slice(0, 1).toUpperCase()
          )}
        </span>
        <span className="flex flex-col">
          <span className="font-medium text-foreground group-hover:underline">{author.displayName}</span>
          <span className="text-xs text-muted-foreground">
            @{author.username} · {identityKindLabel(author.isPrimary)}
            {timestamp && ` · ${formatRelative(timestamp)}`}
          </span>
        </span>
      </Link>
      <div className="ml-auto">
        <FollowButton username={author.username} isFollowing={profile?.isFollowing ?? false} size="sm" />
      </div>
    </div>
  );
}

/** Re-exported so the shared implementation is the only one that exists;
 *  several call sites already import `formatRelative` from here. */
export const formatRelative = formatRelativeTime;
