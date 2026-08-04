import { Link } from "react-router-dom";
import type { PublicationAuthor } from "@/hooks/usePublications";

export function AuthorBadge({
  author,
  timestamp,
  linkToProfile = true,
}: {
  author: PublicationAuthor | null;
  timestamp?: string;
  /** Set false when this badge is already nested inside another link
   * (e.g. PublicationCard) — nesting an <a> inside an <a> is invalid HTML
   * and breaks click targeting. */
  linkToProfile?: boolean;
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

function formatRelative(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const minutes = Math.floor(diffMs / 60_000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}
