import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Search } from "lucide-react";
import { useSearchPublications } from "@/hooks/useSearch";
import { PublicationCard } from "@/components/publication/PublicationCard";
import { CardSkeletonList } from "@/components/CardSkeleton";
import { EmptyState } from "@/components/EmptyState";
import { ErrorState } from "@/components/ErrorState";
import { Input } from "@/components/ui/input";

const SORTS = [
  { value: "relevance", label: "Relevance" },
  { value: "newest", label: "Newest" },
  { value: "oldest", label: "Oldest" },
] as const;

export function SearchPage() {
  const [params, setParams] = useSearchParams();
  const [q, setQ] = useState(params.get("q") ?? "");
  const tag = params.get("tag") ?? undefined;
  const sort = (params.get("sort") as "relevance" | "newest" | "oldest") ?? "relevance";

  const { data, isLoading, isError, refetch } = useSearchPublications({ q: params.get("q") ?? undefined, tag, sort });

  function submitSearch(e: React.FormEvent) {
    e.preventDefault();
    const next = new URLSearchParams(params);
    if (q) next.set("q", q);
    else next.delete("q");
    setParams(next);
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-6">
      <h1 className="text-2xl">Search</h1>

      <form onSubmit={submitSearch} className="mt-4 flex items-center gap-2">
        <div className="relative flex-1">
          <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search titles, thoughts, tags…"
            className="pl-9"
            aria-label="Search"
          />
        </div>
      </form>

      <div className="mt-3 flex items-center gap-2 text-sm">
        {tag && (
          <span className="rounded-full bg-muted px-3 py-1">
            #{tag}{" "}
            <button
              type="button"
              onClick={() => {
                const next = new URLSearchParams(params);
                next.delete("tag");
                setParams(next);
              }}
              aria-label="Clear tag filter"
            >
              ×
            </button>
          </span>
        )}
        <div className="ml-auto flex gap-1">
          {SORTS.map((s) => (
            <button
              key={s.value}
              type="button"
              onClick={() => {
                const next = new URLSearchParams(params);
                next.set("sort", s.value);
                setParams(next);
              }}
              className={`rounded-full px-2 py-1 text-xs ${sort === s.value ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}
            >
              {s.label}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-6">
        {isLoading && <CardSkeletonList />}
        {isError && <ErrorState onRetry={() => refetch()} />}
        {!isLoading && !isError && (!params.get("q") && !tag) && (
          <EmptyState title="Search NotesChain" description="Try a keyword, a tag, or an author's username." />
        )}
        {!isLoading && !isError && (params.get("q") || tag) && data?.data.length === 0 && (
          <EmptyState title="No results" description="Try a different keyword or check the spelling." />
        )}
        {data && data.data.length > 0 && (
          <p className="mb-3 text-sm text-muted-foreground">{data.meta.total} result{data.meta.total === 1 ? "" : "s"}</p>
        )}
        <div className="space-y-3">
          {data?.data.map((pub) => (
            <PublicationCard key={pub.id} publication={pub} />
          ))}
        </div>
      </div>
    </div>
  );
}
