import { useQuery } from "@tanstack/react-query";
import { FlatList, Text, View } from "react-native";
import { api } from "@/src/lib/api";
import { cacheRead, cacheWrite } from "@/src/lib/offline";
import type { Page } from "@/src/lib/models";

type Analytics = { id: string; title: string; uniqueReaders: number; publishedAt: string | null };
export default function AnalyticsScreen() {
  const query = useQuery({ queryKey: ["analytics"], queryFn: async () => { try { const result = await api<Page<Analytics>>("/publications/mine/analytics?page=1&pageSize=25"); cacheWrite("analytics", result); return result.data; } catch { return cacheRead<Page<Analytics>>("analytics")?.data ?? []; } } });
  return <FlatList data={query.data ?? []} keyExtractor={(item) => item.id} ListHeaderComponent={<Text style={{ padding: 20, fontSize: 26, fontWeight: "700" }}>Published notes</Text>} renderItem={({ item }) => <View style={{ padding: 20, borderTopWidth: 1, borderColor: "#ddd" }}><Text>{item.title}</Text><Text>{item.uniqueReaders} unique readers</Text></View>} />;
}
