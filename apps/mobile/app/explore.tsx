import { useQuery } from "@tanstack/react-query";
import { Ionicons } from "@expo/vector-icons";
import { Link } from "expo-router";
import { Pressable, Text, View } from "react-native";
import { apiPage } from "@/src/lib/api";
import { cacheRead, cacheWrite } from "@/src/lib/offline";
import type { Page, Publication } from "@/src/lib/models";
import { EmptyNotes, PublicationCard, PublicationCardSkeleton } from "@/src/components/publication";
import { Action, ErrorText, Eyebrow, Screen, Subtitle, Title, styles } from "@/src/components/ui";
import { useTheme } from "@/src/lib/theme";

export default function ExploreScreen() {
  const { colors } = useTheme();
  const query = useQuery({ queryKey: ["explore"], queryFn: async () => {
    try { const page = await apiPage<Publication>("/publications?page=1&pageSize=50"); cacheWrite("explore", page); return page; }
    catch { const cached = cacheRead<Page<Publication> | Publication[]>("explore"); return Array.isArray(cached) ? { data: cached, meta: { page: 1, pageSize: cached.length, total: cached.length } } : cached ?? { data: [], meta: { page: 1, pageSize: 50, total: 0 } }; }
  } });
  return <Screen refreshing={query.isRefetching} onRefresh={() => void query.refetch()}><View style={{ gap: 8, paddingTop: 4 }}><View style={styles.row}><Eyebrow>Reading room</Eyebrow><Ionicons name="compass-outline" size={18} color={colors.brand} /></View><Title>Explore notes</Title><Subtitle>Recent notes from the NotesChain community.</Subtitle></View>
    <View style={styles.row}><Text style={{ color: colors.muted, fontSize: 13, fontWeight: "700", flex: 1 }}>{query.data?.meta.total ?? 0} published notes</Text><Link href="/verify" asChild><Pressable accessibilityRole="link" accessibilityLabel="Verify a note"><Text style={{ color: colors.brand, fontWeight: "700", fontSize: 14 }}>Verify a note</Text></Pressable></Link></View>
    {query.isError && <ErrorText>We could not refresh Explore. Your saved notes are still available below.</ErrorText>}
    {query.isLoading ? [0, 1, 2].map((i) => <PublicationCardSkeleton key={i} />) : query.data?.data.length ? query.data.data.map((item) => <PublicationCard key={item.id} publication={item} />) : <EmptyNotes title="No notes published yet" detail="Be the first to publish a note worth returning to." />}
  </Screen>;
}

/** A rendering problem must stay on this route rather than closing the native app. */
export function ErrorBoundary({ retry }: { error: Error; retry: () => void }) {
  return <Screen><View style={{ gap: 10, paddingTop: 12 }}><Eyebrow>Explore</Eyebrow><Title>We could not open Explore</Title><Subtitle>Your app is still running. Try opening the feed again.</Subtitle><Action title="Try again" onPress={retry} /></View></Screen>;
}
