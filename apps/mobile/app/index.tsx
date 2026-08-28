import { useEffect, useState } from "react";
import { Ionicons } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";
import { Link, router } from "expo-router";
import { Pressable, Text, View } from "react-native";
import { api, apiPage, getToken } from "@/src/lib/api";
import { cacheRead, cacheWrite } from "@/src/lib/offline";
import type { Page, Publication } from "@/src/lib/models";
import { EmptyNotes, PublicationCard, PublicationCardSkeleton } from "@/src/components/publication";
import { Action, ErrorText, Eyebrow, Screen, Subtitle, Title, styles } from "@/src/components/ui";
import { useTheme } from "@/src/lib/theme";
import { hasSeenOnboarding } from "@/src/lib/first-run";

type Tab = "following" | "latest";

function cachedTab(tab: Tab) {
  const cached = cacheRead<Page<Publication> | Publication[]>(`home:${tab}`);
  return Array.isArray(cached) ? cached : cached?.data;
}

async function fetchTab(tab: Tab) {
  const path = tab === "following" ? "/publications?feed=following&page=1&pageSize=20" : "/publications?page=1&pageSize=20";
  const result = await apiPage<Publication>(path);
  cacheWrite(`home:${tab}`, result);
  return result.data;
}

export default function HomeScreen() {
  const { colors } = useTheme();
  // null = still deciding; signed-out visitors and offline sessions never
  // see the tab bar at all — there is nothing to follow without an account.
  const [tab, setTab] = useState<Tab | null>(null);
  const [signedIn, setSignedIn] = useState(false);

  useEffect(() => {
    void hasSeenOnboarding().then((seen) => { if (!seen) router.replace("/onboarding"); });
  }, []);

  useEffect(() => {
    (async () => {
      const token = await getToken();
      if (!token) { setTab("latest"); return; }
      setSignedIn(true);
      // The public feed must never wait for a protected preference lookup.
      // It can render cached/latest notes immediately, then switch to
      // Following only if that small request completes successfully.
      setTab("latest");
      try {
        const following = await api<unknown[]>("/follows/mine");
        setTab(following.length > 0 ? "following" : "latest");
      } catch { /* Latest is already visible; the next refresh can retry. */ }
    })();
  }, []);

  const query = useQuery({
    queryKey: ["home", tab],
    enabled: tab !== null,
    queryFn: () => fetchTab(tab!),
    initialData: tab ? () => cachedTab(tab) : undefined,
  });

  return (
    <Screen refreshing={query.isRefetching} onRefresh={() => void query.refetch()}>
      <View style={{ gap: 10 }}>
        <Title>Thoughts worth keeping.</Title>
        <Subtitle>Read notes with a record you can verify, whenever you need them.</Subtitle>
      </View>

      <Action title="Explore notes" onPress={() => router.push("/explore")} icon={<Ionicons name="compass-outline" size={19} color="#fff" />} />

      <Link href="/verify" asChild><Pressable accessibilityRole="link" accessibilityLabel="Verify a note" accessibilityHint="Check a note against its public record"><Text style={{ color: colors.brand, fontWeight: "700", fontSize: 15 }}>Verify a note →</Text></Pressable></Link>

      <View style={{ gap: 2, marginTop: 10 }}>
        <Eyebrow>{tab === "following" ? "Following" : "Recent notes"}</Eyebrow>
        <Text style={{ color: colors.ink, fontFamily: "serif", fontSize: 24, fontWeight: "700" }}>
          {tab === "following" ? "Notes from authors you follow" : "Latest notes"}
        </Text>
      </View>

      {signedIn && tab && (
        <View style={styles.row}>
          <Action
            title="Following"
            tone={tab === "following" ? "primary" : "secondary"}
            accessibilityRole="radio"
            accessibilityState={{ checked: tab === "following" }}
            onPress={() => setTab("following")}
          />
          <Action
            title="Latest"
            tone={tab === "latest" ? "primary" : "secondary"}
            accessibilityRole="radio"
            accessibilityState={{ checked: tab === "latest" }}
            onPress={() => setTab("latest")}
          />
        </View>
      )}

      {query.isError && <ErrorText>We couldn’t refresh this feed. Pull down or try again when you’re connected.</ErrorText>}

      {query.isLoading || tab === null ? (
        [0, 1, 2].map((i) => <PublicationCardSkeleton key={i} />)
      ) : query.data?.length ? (
        query.data.map((item) => <PublicationCard key={item.id} publication={item} />)
      ) : tab === "following" ? (
        <EmptyNotes title="Nothing new yet" detail="Follow a few authors to see their notes here." />
      ) : (
        <EmptyNotes title={query.isError ? "Couldn’t load notes" : "No notes published yet"} detail={query.isError ? "Check your connection and pull down to retry." : "Be the first to publish a note worth returning to."} />
      )}
    </Screen>
  );
}
