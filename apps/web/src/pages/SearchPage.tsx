import { useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Search } from "lucide-react";
import { useSearchPeople, useSearchPublications } from "@/hooks/useSearch";
import { PublicationCard } from "@/components/publication/PublicationCard";
import { CardSkeletonList } from "@/components/CardSkeleton";
import { EmptyState } from "@/components/EmptyState";
import { ErrorState } from "@/components/ErrorState";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { identityKindLabel } from "@noteschain/shared";

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
  const scope = (params.get("scope") as "notes" | "people") ?? "notes";

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
            placeholder={scope === "people" ? "Search authors and pen names…" : "Search note titles and tags…"}
            className="pl-9"
            aria-label="Search"
          />
        </div>
      </form>

      <Tabs
        value={scope}
        onValueChange={(v) => {
          const next = new URLSearchParams(params);
          next.set("scope", v);
          setParams(next);
        }}
        className="mt-4"
      >
        <TabsList>
          <TabsTrigger value="notes">Notes</TabsTrigger>
          <TabsTrigger value="people">People</TabsTrigger>
        </TabsList>

        <TabsContent value="notes" className="mt-4">
          <NotesResults params={params} setParams={setParams} tag={tag} sort={sort} />
        </TabsContent>
        <TabsContent value="people" className="mt-4">
          <PeopleResults q={params.get("q") ?? ""} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function NotesResults({
  params,
  setParams,
  tag,
  sort,
}: {
  params: URLSearchParams;
  setParams: (params: URLSearchParams) => void;
  tag?: string;
  sort: "relevance" | "newest" | "oldest";
}) {
  const { data, isLoading, isError, refetch } = useSearchPublications({ q: params.get("q") ?? undefined, tag, sort });

  return (
    <div>
      <div className="flex items-center gap-2 text-sm">
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

      <div className="mt-4">
        {isLoading && <CardSkeletonList />}
        {isError && <ErrorState onRetry={() => refetch()} />}
        {!isLoading && !isError && !params.get("q") && !tag && (
          <EmptyState title="Search notes" description="Start with a title, a phrase you remember, a tag, or an author’s username." />
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

function PeopleResults({ q }: { q: string }) {
  const { data, isLoading, isError, refetch } = useSearchPeople(q);

  if (!q.trim()) {
    return <EmptyState title="Search for an author" description="Search by username or display name." />;
  }
  if (isLoading) return <CardSkeletonList />;
  if (isError) return <ErrorState onRetry={() => refetch()} />;
  if (data?.data.length === 0) {
    return <EmptyState title="No one found" description="Try a different keyword or check the spelling." />;
  }

  return (
    <ul className="space-y-2">
      {data?.data.map((person) => (
        <li key={person.username}>
          <Link
            to={`/@${person.username}`}
            className="flex items-center gap-3 rounded-md border border-border bg-surface p-3 hover:border-primary"
          >
            <span className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full bg-muted text-sm font-medium">
              {person.avatarUrl ? (
                <img src={person.avatarUrl} alt="" className="h-full w-full object-cover" />
              ) : (
                person.displayName.slice(0, 1).toUpperCase()
              )}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate font-medium text-foreground">{person.displayName}</span>
              <span className="block text-xs text-muted-foreground">
                @{person.username} · {identityKindLabel(person.isPrimary)} · {person.publicationCount} notes
              </span>
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
