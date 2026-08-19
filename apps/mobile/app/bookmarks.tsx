import { useQuery } from "@tanstack/react-query";
import { Link } from "expo-router";
import { Text } from "react-native";
import { api } from "@/src/lib/api";
import { cacheRead, cacheWrite } from "@/src/lib/offline";
import type { Publication } from "@/src/lib/models";
import { Loading, Screen, Subtitle, Title, styles } from "@/src/components/ui";

type Bookmark = { id: string; publication: Publication };
export default function BookmarksScreen() {
  const query = useQuery({ queryKey: ["bookmarks"], queryFn: async () => { try { const rows = await api<Bookmark[]>("/bookmarks"); cacheWrite("bookmarks", rows); return rows; } catch { return cacheRead<Bookmark[]>("bookmarks") ?? []; } } });
  if (query.isLoading) return <Loading label="Loading saved notes…" />;
  return <Screen><Title>Saved</Title>{query.data?.length ? query.data.map(({ id, publication }) => <Link key={id} href={`/note/${publication.id}`} style={styles.card}><Text style={{ fontWeight: "700" }}>{publication.title}</Text><Text numberOfLines={2} style={styles.subtitle}>{publication.excerpt}</Text></Link>) : <Subtitle>Nothing saved yet. Bookmark a note to find it here later.</Subtitle>}</Screen>;
}
