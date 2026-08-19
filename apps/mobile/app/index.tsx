import { useQuery } from "@tanstack/react-query";
import { Link } from "expo-router";
import { FlatList, RefreshControl, Text, View } from "react-native";
import { api } from "@/src/lib/api";
import { cacheRead, cacheWrite } from "@/src/lib/offline";
import type { Page, Publication } from "@/src/lib/models";
import { styles } from "@/src/components/ui";

async function publications() {
  try { const result = await api<Page<Publication>>("/publications?page=1&pageSize=20"); cacheWrite("home:1", result); return result.data; }
  catch { return cacheRead<Page<Publication>>("home:1")?.data ?? []; }
}
export default function HomeScreen() {
  const query = useQuery({ queryKey: ["home"], queryFn: publications });
  return <FlatList data={query.data ?? []} keyExtractor={(item) => item.id} refreshControl={<RefreshControl refreshing={query.isRefetching} onRefresh={() => query.refetch()} />}
    ListHeaderComponent={<View style={{ padding: 20, gap: 10 }}><Text style={styles.title}>NotesChain</Text><Text style={styles.subtitle}>Permanent, verifiable thoughts.</Text><View style={styles.row}><Link href="/explore">Explore</Link><Link href="/search">Search</Link><Link href="/account">Account</Link></View></View>}
    renderItem={({ item }) => <Link href={`/note/${item.id}`} style={{ padding: 20, borderTopWidth: 1, borderColor: "#ddd" }}><Text style={{ fontSize: 18, fontWeight: "600" }}>{item.title}</Text><Text numberOfLines={3}>{item.excerpt}</Text></Link>}
    ListEmptyComponent={<Text style={{ padding: 20 }}>{query.isLoading ? "Loading notes…" : "No cached notes yet. Connect to read NotesChain."}</Text>} />;
}
