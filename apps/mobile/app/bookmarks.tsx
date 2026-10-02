import { useQuery } from "@tanstack/react-query";
import { api } from "@/src/lib/api";
import { cacheRead, cacheWrite } from "@/src/lib/offline";
import type { Publication } from "@/src/lib/models";
import { EmptyNotes, PublicationCard, PublicationCardSkeleton } from "@/src/components/publication";
import { Eyebrow, Screen, Subtitle, Title } from "@/src/components/ui";
import { ErrorState } from "@/src/components/error-state";

type Bookmark = { id: string; publication: Publication };
export default function BookmarksScreen() {
  const query = useQuery({ queryKey: ["bookmarks"], queryFn: async () => { try { const rows = await api<Bookmark[]>("/bookmarks"); cacheWrite("bookmarks", rows); return rows; } catch (error) { const cached = cacheRead<Bookmark[]>("bookmarks"); if (cached) return cached; throw error; } } });
  return <Screen refreshing={query.isRefetching} onRefresh={() => void query.refetch()}><Eyebrow>Your library</Eyebrow><Title>Saved notes</Title><Subtitle>Thoughts you want to return to, even when you are offline.</Subtitle>{query.isLoading ? [0, 1, 2].map((i) => <PublicationCardSkeleton key={i} />) : query.data?.length ? query.data.map(({ id, publication }) => <PublicationCard key={id} publication={publication} />) : query.isError ? <ErrorState title="We couldn't load your saved notes" onRetry={() => void query.refetch()} /> : <EmptyNotes title="Nothing saved yet" detail="Bookmark a note to find it here later." />}</Screen>;
}
