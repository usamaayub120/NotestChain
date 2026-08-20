import { useQuery } from "@tanstack/react-query";
import { Ionicons } from "@expo/vector-icons";
import { Text, View } from "react-native";
import { api } from "@/src/lib/api";
import { cacheRead, cacheWrite } from "@/src/lib/offline";
import type { Page } from "@/src/lib/models";
import { EmptyNotes } from "@/src/components/publication";
import { Eyebrow, Loading, Screen, Subtitle, Title, colors, styles } from "@/src/components/ui";

type Analytics = { id: string; title: string; uniqueReaders: number; publishedAt: string | null };
export default function AnalyticsScreen() {
  const query = useQuery({ queryKey: ["analytics"], queryFn: async () => { try { const result = await api<Page<Analytics>>("/publications/mine/analytics?page=1&pageSize=25"); cacheWrite("analytics", result); return result.data; } catch { return cacheRead<Page<Analytics>>("analytics")?.data ?? []; } } });
  if (query.isLoading) return <Loading label="Loading your reader analytics…" />;
  return <Screen><View style={{ gap: 6, paddingTop: 4 }}><Eyebrow>Writer analytics</Eyebrow><Title>Published notes</Title><Subtitle>Unique readers since this privacy-preserving metric began.</Subtitle></View>{query.data?.length ? query.data.map((item) => <View key={item.id} style={[styles.card, { flexDirection: "row", alignItems: "center", gap: 14 }]}><View style={{ width: 42, height: 42, borderRadius: 21, backgroundColor: "#fce1d9", alignItems: "center", justifyContent: "center" }}><Ionicons name="eye-outline" size={21} color={colors.brand} /></View><View style={{ flex: 1, gap: 4 }}><Text style={{ color: colors.ink, fontSize: 16, fontWeight: "800" }}>{item.title}</Text><Subtitle>{item.publishedAt ? new Date(item.publishedAt).toLocaleDateString() : "Pending publication"}</Subtitle></View><Text style={{ color: colors.canopy, fontSize: 16, fontWeight: "800" }}>{item.uniqueReaders}</Text></View>) : <EmptyNotes title="No published notes yet" detail="Publish a note to see its unique readers here." />}</Screen>;
}
