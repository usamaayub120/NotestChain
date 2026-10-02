import { useEffect, useState } from "react";
import { Ionicons } from "@expo/vector-icons";
import { useInfiniteQuery } from "@tanstack/react-query";
import { Link, router } from "expo-router";
import { Pressable, Text, View } from "react-native";
import { api, apiPage, getToken } from "@/src/lib/api";
import { cacheRead, cacheWrite } from "@/src/lib/offline";
import type { Page, Publication } from "@/src/lib/models";
import { EmptyNotes, PublicationCard, PublicationCardSkeleton } from "@/src/components/publication";
import { Action, Eyebrow, ListScreen, Subtitle, Title, styles } from "@/src/components/ui";
import { ErrorState } from "@/src/components/error-state";
import { useTheme } from "@/src/lib/theme";
import { hasSeenOnboarding } from "@/src/lib/first-run";
import { fonts } from "@/src/lib/fonts";

type Tab = "following" | "latest";

function cachedTab(tab: Tab) {
  const cached = cacheRead<Page<Publication> | Publication[]>(`home:${tab}`);
  return Array.isArray(cached) ? cached : cached?.data;
}

const PAGE_SIZE = 20;

async function fetchTab(tab: Tab, page: number) {
  const feed = tab === "following" ? "feed=following&" : "";
  const result = await apiPage<Publication>(`/publications?${feed}page=${page}&pageSize=${PAGE_SIZE}`);
  if (page === 1) cacheWrite(`home:${tab}`, result);
  return result;
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

  // Was a single page of 20 with a hard stop: no way to reach the 21st note
  // on the app's default screen.
  const query = useInfiniteQuery({
    queryKey: ["home", tab],
    enabled: tab !== null,
    initialPageParam: 1,
    queryFn: async ({ pageParam }) => {
      try {
        return await fetchTab(tab!, pageParam);
      } catch (error) {
        if (pageParam !== 1) throw error;
        const cached = cachedTab(tab!);
        if (cached) return { data: cached, meta: { page: 1, pageSize: cached.length, total: cached.length } };
        throw error;
      }
    },
    getNextPageParam: (last) => {
      const loaded = last.meta.page * last.meta.pageSize;
      return loaded < last.meta.total ? last.meta.page + 1 : undefined;
    },
  });

  const notes = query.data?.pages.flatMap((page) => page.data) ?? [];

  const header = (
    <>
      <View style={{ gap: 10 }}>
        <Title>Thoughts worth keeping.</Title>
        <Subtitle>Read notes with a record you can verify, whenever you need them.</Subtitle>
      </View>

      <Action title="Explore notes" onPress={() => router.push("/explore")} icon={<Ionicons name="compass-outline" size={19} color={colors.onBrand} />} />

      <Link href="/verify" asChild>
        <Pressable accessibilityRole="link" accessibilityLabel="Verify a note" accessibilityHint="Check a note against its public record" hitSlop={12} style={{ paddingVertical: 10 }}>
          <Text style={{ color: colors.brand, fontWeight: "700", fontSize: 15 }}>Verify a note →</Text>
        </Pressable>
      </Link>

      <View style={{ gap: 2, marginTop: 10 }}>
        <Eyebrow>{tab === "following" ? "Following" : "Recent notes"}</Eyebrow>
        <Text style={{ color: colors.ink, fontFamily: fonts.display, fontSize: 24 }}>
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

      {(query.isLoading || tab === null) && [0, 1, 2].map((i) => <PublicationCardSkeleton key={i} />)}
    </>
  );

  return (
    <ListScreen
      data={notes}
      keyExtractor={(item) => item.id}
      renderItem={(item) => <PublicationCard publication={item} />}
      header={header}
      refreshing={query.isRefetching && !query.isFetchingNextPage}
      onRefresh={() => void query.refetch()}
      onEndReached={() => {
        if (query.hasNextPage && !query.isFetchingNextPage) void query.fetchNextPage();
      }}
      empty={
        query.isLoading || tab === null ? null : query.isError ? (
          // Used to render an ErrorText AND an EmptyNotes saying the same
          // thing in different words, both at once.
          <ErrorState title="We couldn't load this feed" onRetry={() => void query.refetch()} />
        ) : tab === "following" ? (
          <EmptyNotes title="Nothing new yet" detail="Follow a few authors to see their notes here." />
        ) : (
          <EmptyNotes title="No notes published yet" detail="Be the first to publish a note worth returning to." />
        )
      }
      footer={
        query.isFetchingNextPage ? (
          <PublicationCardSkeleton />
        ) : notes.length > 0 && !query.hasNextPage ? (
          <Subtitle>That's everything for now.</Subtitle>
        ) : null
      }
    />
  );
}
