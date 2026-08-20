import { useQuery } from "@tanstack/react-query";
import { Ionicons } from "@expo/vector-icons";
import { Text, View } from "react-native";
import { api } from "@/src/lib/api";
import { cacheRead, cacheWrite } from "@/src/lib/offline";
import type { Page, Publication } from "@/src/lib/models";
import { EmptyNotes, PublicationCard } from "@/src/components/publication";
import { Action, ErrorText, Eyebrow, Loading, Screen, Subtitle, Title, colors, styles } from "@/src/components/ui";

export default function ExploreScreen() {
  const query = useQuery({ queryKey: ["explore"], queryFn: async () => {
    try { const page = await api<Page<Publication>>("/publications?page=1&pageSize=50"); cacheWrite("explore", page); return page; }
    catch { return cacheRead<Page<Publication>>("explore") ?? { data: [], meta: { page: 1, pageSize: 50, total: 0 } }; }
  } });
  if (query.isLoading) return <Loading label="Finding notes…" />;
  return <Screen><View style={{ gap: 8, paddingTop: 4 }}><View style={styles.row}><Eyebrow>Reading room</Eyebrow><Ionicons name="compass-outline" size={18} color={colors.brand} /></View><Title>Explore thoughts</Title><Subtitle>Recently kept ideas from the NotesChain community.</Subtitle></View>
    <View style={[styles.row, { justifyContent: "space-between", marginTop: 2 }]}><Text style={{ color: colors.muted, fontSize: 13, fontWeight: "700" }}>{query.data?.meta.total ?? 0} published notes</Text><View style={{ width: 104 }}><Action title={query.isRefetching ? "Refreshing" : "Refresh"} tone="secondary" disabled={query.isRefetching} onPress={() => void query.refetch()} /></View></View>
    {query.isError && <ErrorText>We could not refresh Explore. Your saved notes are still available below.</ErrorText>}
    {query.data?.data.length ? query.data.data.map((item) => <PublicationCard key={item.id} publication={item} />) : <EmptyNotes title="Nothing’s been kept yet" detail="Be the first to publish something worth returning to." />}
  </Screen>;
}
