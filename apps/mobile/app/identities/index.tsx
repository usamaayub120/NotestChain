import { useQuery } from "@tanstack/react-query";
import { Link, router } from "expo-router";
import { Text } from "react-native";
import { api } from "@/src/lib/api";
import { cacheRead, cacheWrite } from "@/src/lib/offline";
import type { Identity } from "@/src/lib/models";
import { Action, Loading, Screen, Subtitle, Title, styles } from "@/src/components/ui";

export default function IdentitiesScreen() {
  const query = useQuery({ queryKey: ["identities"], queryFn: async () => { try { const rows = await api<Identity[]>("/identities"); cacheWrite("identities", rows); return rows; } catch { return cacheRead<Identity[]>("identities") ?? []; } } });
  if (query.isLoading) return <Loading label="Loading identities…" />;
  return <Screen><Title>Public identities</Title><Subtitle>Choose an identity when publishing named or pseudonymous notes.</Subtitle><Action title="Create an identity" onPress={() => router.push("/identities/new")} />{query.data?.length ? query.data.map((identity) => <Link key={identity.id} href={`/profile/${identity.username}`} style={styles.card}><Text style={{ fontWeight: "700" }}>{identity.displayName}</Text><Subtitle>@{identity.username} · {identity.type === "REAL_NAME" ? "Real name" : "Pseudonym"}</Subtitle>{identity.bio ? <Text numberOfLines={2}>{identity.bio}</Text> : null}</Link>) : <Subtitle>No identities yet. Anonymous publishing does not need one.</Subtitle>}</Screen>;
}
