import { useQuery } from "@tanstack/react-query";
import { api } from "@/src/lib/api";
import { cacheRead, cacheWrite } from "@/src/lib/offline";
import type { Publication } from "@/src/lib/models";
import { EmptyNotes, PublicationCard } from "@/src/components/publication";
import { Eyebrow, Loading, Screen, Subtitle, Title } from "@/src/components/ui";

type Bookmark = { id: string; publication: Publication };
export default function BookmarksScreen() {
  const query = useQuery({ queryKey: ["bookmarks"], queryFn: async () => { try { const rows = await api<Bookmark[]>("/bookmarks"); cacheWrite("bookmarks", rows); return rows; } catch { return cacheRead<Bookmark[]>("bookmarks") ?? []; } } });
  if (query.isLoading) return <Loading label="Loading saved notes…" />;
  return <Screen><Eyebrow>Your library</Eyebrow><Title>Saved notes</Title><Subtitle>Thoughts you want to return to, even when you are offline.</Subtitle>{query.data?.length ? query.data.map(({ id, publication }) => <PublicationCard key={id} publication={publication} />) : <EmptyNotes title="Nothing saved yet" detail="Bookmark a note to find it here later." />}</Screen>;
}
