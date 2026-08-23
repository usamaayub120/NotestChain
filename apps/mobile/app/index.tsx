import { useEffect } from "react";
import { Ionicons } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";
import { Link, router } from "expo-router";
import { Text, View } from "react-native";
import { apiPage } from "@/src/lib/api";
import { cacheRead, cacheWrite } from "@/src/lib/offline";
import type { Page, Publication } from "@/src/lib/models";
import { EmptyNotes, PublicationCard, PublicationCardSkeleton } from "@/src/components/publication";
import { Action, Eyebrow, Screen, Subtitle, Title, styles } from "@/src/components/ui";
import { useTheme } from "@/src/lib/theme";
import { hasSeenOnboarding } from "@/src/lib/first-run";

async function publications() {
  try { const result = await apiPage<Publication>("/publications?page=1&pageSize=20"); cacheWrite("home:1", result); return result.data; }
  catch { const cached = cacheRead<Page<Publication> | Publication[]>("home:1"); return Array.isArray(cached) ? cached : cached?.data ?? []; }
}
export default function HomeScreen() {
  const { colors } = useTheme();
  const query = useQuery({ queryKey: ["home"], queryFn: publications });
  useEffect(() => { void hasSeenOnboarding().then((seen) => { if (!seen) router.replace("/onboarding"); }); }, []);
  return <Screen refreshing={query.isRefetching} onRefresh={() => void query.refetch()}><View style={{ gap: 10, paddingTop: 16 }}><View style={styles.row}><Ionicons name="checkmark-circle" size={23} color={colors.brand} /><Eyebrow>NotesChain</Eyebrow></View><Title>Thoughts worth keeping.</Title><Subtitle>Read ideas with a record you can verify, whenever you need them.</Subtitle></View>
    <View style={styles.row}><View style={{ flex: 1 }}><Action title="Explore thoughts" onPress={() => router.push("/explore")} icon={<Ionicons name="compass-outline" size={19} color="#fff" />} /></View><View style={{ width: 112 }}><Action title="Search" tone="secondary" icon={<Ionicons name="search-outline" size={18} color={colors.ink} />} onPress={() => router.push("/search")} /></View></View>
    <Link href="/verify" style={{ color: colors.brand, fontWeight: "700", fontSize: 14 }}>Verify a note against the blockchain record →</Link>
    <View style={{ gap: 2, marginTop: 10 }}><Eyebrow>Recently kept</Eyebrow><Text style={{ color: colors.ink, fontFamily: "serif", fontSize: 24, fontWeight: "700" }}>Latest notes</Text></View>
    {query.isLoading ? [0, 1, 2].map((i) => <PublicationCardSkeleton key={i} />) : query.data?.length ? query.data.map((item) => <PublicationCard key={item.id} publication={item} />) : <EmptyNotes title="No notes cached yet" detail="Connect to NotesChain to begin reading." />}
  </Screen>;
}
