import { useInfiniteQuery } from "@tanstack/react-query";
import { Ionicons } from "@expo/vector-icons";
import { Link } from "expo-router";
import { Pressable, Text, View } from "react-native";
import { apiPage } from "@/src/lib/api";
import { cacheRead, cacheWrite } from "@/src/lib/offline";
import type { Page, Publication } from "@/src/lib/models";
import { EmptyNotes, PublicationCard, PublicationCardSkeleton } from "@/src/components/publication";
import { Action, Eyebrow, ListScreen, Screen, Subtitle, Title, styles } from "@/src/components/ui";
import { ErrorState } from "@/src/components/error-state";
import { useTheme } from "@/src/lib/theme";

const PAGE_SIZE = 25;

export default function ExploreScreen() {
  const { colors } = useTheme();

  /**
   * Was a single page of 50, mapped inside a ScrollView: every card mounted
   * and resident, a hard stop at item 50, and no way to reach the 51st -
   * while the header displayed `meta.total`, so the screen told the reader
   * there were 300 notes and then showed 50 of them.
   */
  const query = useInfiniteQuery({
    queryKey: ["explore"],
    initialPageParam: 1,
    queryFn: async ({ pageParam }) => {
      try {
        const page = await apiPage<Publication>(`/publications?page=${pageParam}&pageSize=${PAGE_SIZE}`);
        if (pageParam === 1) cacheWrite("explore", page);
        return page;
      } catch (error) {
        // Offline-first only for the first page; a failed "load more" is a
        // real failure and should say so rather than silently repeating
        // what is already on screen.
        if (pageParam !== 1) throw error;
        const cached = cacheRead<Page<Publication> | Publication[]>("explore");
        if (Array.isArray(cached)) return { data: cached, meta: { page: 1, pageSize: cached.length, total: cached.length } };
        if (cached) return cached;
        throw error;
      }
    },
    getNextPageParam: (last) => {
      const loaded = last.meta.page * last.meta.pageSize;
      return loaded < last.meta.total ? last.meta.page + 1 : undefined;
    },
  });

  const notes = query.data?.pages.flatMap((page) => page.data) ?? [];
  const total = query.data?.pages[0]?.meta.total ?? 0;

  const header = (
    <>
      <View style={{ gap: 8, paddingTop: 4 }}>
        <View style={styles.row}>
          <Eyebrow>Reading room</Eyebrow>
          <Ionicons name="compass-outline" size={18} color={colors.brand} />
        </View>
        <Title>Explore notes</Title>
        <Subtitle>Recent notes from the NotesChain community.</Subtitle>
      </View>
      <View style={styles.row}>
        <Text style={{ color: colors.muted, fontSize: 13, fontWeight: "700", flex: 1 }}>
          {total} published note{total === 1 ? "" : "s"}
        </Text>
        <Link href="/verify" asChild>
          <Pressable accessibilityRole="link" accessibilityLabel="Verify a note" hitSlop={10}>
            <Text style={{ color: colors.brand, fontWeight: "700", fontSize: 14 }}>Verify a note</Text>
          </Pressable>
        </Link>
      </View>
      {query.isLoading && [0, 1, 2].map((i) => <PublicationCardSkeleton key={i} />)}
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
        query.isLoading ? null : query.isError ? (
          <ErrorState title="We couldn't load Explore" onRetry={() => void query.refetch()} />
        ) : (
          <EmptyNotes title="No notes published yet" detail="Be the first to publish a note worth returning to." />
        )
      }
      footer={
        query.isFetchingNextPage ? (
          <PublicationCardSkeleton />
        ) : notes.length > 0 && !query.hasNextPage ? (
          // An end-of-list marker, so reaching the bottom reads as "that's
          // all of them" rather than as the feed having stopped working.
          <Subtitle>That's every published note for now.</Subtitle>
        ) : null
      }
    />
  );
}

/** A rendering problem must stay on this route rather than closing the native app. */
export function ErrorBoundary({ retry }: { error: Error; retry: () => void }) {
  return <Screen><View style={{ gap: 10, paddingTop: 12 }}><Eyebrow>Explore</Eyebrow><Title>We could not open Explore</Title><Subtitle>Your app is still running. Try opening the feed again.</Subtitle><Action title="Try again" onPress={retry} /></View></Screen>;
}
