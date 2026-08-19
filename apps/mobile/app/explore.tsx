import { useQuery } from "@tanstack/react-query";
import { Link } from "expo-router";
import { FlatList, RefreshControl, Text, View } from "react-native";
import { api } from "@/src/lib/api";
import { cacheRead, cacheWrite } from "@/src/lib/offline";
import type { Page, Publication } from "@/src/lib/models";
import { Loading, Subtitle, Title, styles } from "@/src/components/ui";

export default function ExploreScreen() {
  const query = useQuery({ queryKey: ["explore"], queryFn: async () => {
    try { const page = await api<Page<Publication>>("/publications?page=1&pageSize=50"); cacheWrite("explore", page); return page; }
    catch { return cacheRead<Page<Publication>>("explore") ?? { data: [], meta: { page: 1, pageSize: 50, total: 0 } }; }
  } });
  if (query.isLoading) return <Loading label="Finding notes…" />;
  return <FlatList data={query.data?.data ?? []} keyExtractor={(item) => item.id} refreshControl={<RefreshControl refreshing={query.isRefetching} onRefresh={() => query.refetch()} />}
    ListHeaderComponent={<View style={{ padding: 20, gap: 6 }}><Title>Explore</Title><Subtitle>{query.data?.meta.total ?? 0} published notes</Subtitle></View>}
    renderItem={({ item }) => <Link href={`/note/${item.id}`} style={{ padding: 20, borderTopWidth: 1, borderColor: "#e7e5e4" }}><Text style={{ fontSize: 18, fontWeight: "600" }}>{item.title}</Text><Text numberOfLines={3} style={styles.subtitle}>{item.excerpt}</Text><Text style={[styles.subtitle, { marginTop: 6 }]}>{item.author ? `by ${item.author.displayName}` : "Anonymous"}</Text></Link>}
    ListEmptyComponent={<Text style={{ padding: 20 }}>No notes are available yet.</Text>} />;
}
