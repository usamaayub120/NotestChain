import { useQuery } from "@tanstack/react-query";
import { Link } from "expo-router";
import { FlatList, Text, View } from "react-native";
import { api } from "@/src/lib/api";
import { cacheRead, cacheWrite } from "@/src/lib/offline";
import type { Draft } from "@/src/lib/models";

export default function DraftsScreen() {
  const query = useQuery({ queryKey: ["drafts"], queryFn: async () => { try { const drafts = await api<Draft[]>("/drafts"); cacheWrite("drafts", drafts); return drafts; } catch { return cacheRead<Draft[]>("drafts") ?? []; } } });
  return <FlatList data={query.data ?? []} keyExtractor={(item) => item.id} ListHeaderComponent={<View style={{ padding: 20 }}><Text style={{ fontSize: 26, fontWeight: "700" }}>Drafts</Text><Link href="/draft/new">New draft</Link></View>} renderItem={({ item }) => <Link href={`/draft/${item.id}`} style={{ padding: 20, borderTopWidth: 1, borderColor: "#ddd" }}><Text>{item.title || "Untitled"}</Text><Text>{item.status}</Text></Link>} ListEmptyComponent={<Text style={{ padding: 20 }}>No drafts available offline.</Text>} />;
}
