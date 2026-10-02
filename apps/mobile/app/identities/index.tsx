import { useQuery } from "@tanstack/react-query";
import { Link, router } from "expo-router";
import { Text } from "react-native";
import { api } from "@/src/lib/api";
import { cacheRead, cacheWrite } from "@/src/lib/offline";
import type { Identity } from "@/src/lib/models";
import { Action, Loading, Screen, Subtitle, Title, styles } from "@/src/components/ui";
import { useTheme } from "@/src/lib/theme";
import { ErrorState } from "@/src/components/error-state";

export default function IdentitiesScreen() {
  const { colors } = useTheme();
  const query = useQuery({
    queryKey: ["identities"],
    queryFn: async () => {
      try {
        const rows = await api<Identity[]>("/identities");
        cacheWrite("identities", rows);
        return rows;
      } catch (error) {
        // The cache fallback is offline-first and right. Returning [] when
        // there is no cache is what told a reader their bylines did not
        // exist, instead of that the request failed.
        const cached = cacheRead<Identity[]>("identities");
        if (cached) return cached;
        throw error;
      }
    },
  });
  if (query.isLoading) return <Loading label="Loading your bylines…" />;
  if (query.isError) {
    return <Screen><ErrorState title="We couldn't load your bylines" onRetry={() => void query.refetch()} /></Screen>;
  }

  const keeperProfile = query.data?.find((identity) => identity.isPrimary);
  const penNames = query.data?.filter((identity) => !identity.isPrimary) ?? [];

  return (
    <Screen>
      <Title>Your bylines</Title>
      <Subtitle>Every note or comment goes out under your Keeper profile or one of your pen names.</Subtitle>

      {keeperProfile && (
        <>
          <Text style={{ color: colors.muted, fontWeight: "700", fontSize: 13, textTransform: "uppercase" }}>Keeper profile</Text>
          <Link
            href={`/identities/${keeperProfile.id}`}
            style={[styles.card, { borderColor: colors.border, backgroundColor: colors.surface }]}
          >
            <Text style={{ fontWeight: "700", color: colors.ink }}>{keeperProfile.displayName}</Text>
            <Subtitle>@{keeperProfile.username} · Your own profile</Subtitle>
          </Link>
        </>
      )}

      <Text style={{ color: colors.muted, fontWeight: "700", fontSize: 13, textTransform: "uppercase" }}>Pen names</Text>
      <Action title="New pen name" tone="secondary" onPress={() => router.push("/identities/new")} />
      {penNames.length ? (
        penNames.map((identity) => (
          <Link
            key={identity.id}
            href={`/identities/${identity.id}`}
            style={[styles.card, { borderColor: colors.border, backgroundColor: colors.surface }]}
          >
            <Text style={{ fontWeight: "700", color: colors.ink }}>{identity.displayName}</Text>
            <Subtitle>@{identity.username} · {identity.isVisible ? "Visible" : "Hidden"}</Subtitle>
            {identity.bio ? <Text numberOfLines={2} style={{ color: colors.ink }}>{identity.bio}</Text> : null}
          </Link>
        ))
      ) : (
        <Subtitle>No pen names yet. Create one to publish or comment under something other than your own name.</Subtitle>
      )}
    </Screen>
  );
}
