import { useQuery } from "@tanstack/react-query";
import { Ionicons } from "@expo/vector-icons";
import { Text, View } from "react-native";
import { apiPage } from "@/src/lib/api";
import { cacheRead, cacheWrite } from "@/src/lib/offline";
import type { Page } from "@/src/lib/models";
import { EmptyNotes } from "@/src/components/publication";
import { Card, Eyebrow, Screen, Skeleton, Subtitle, Title } from "@/src/components/ui";
import { useTheme } from "@/src/lib/theme";
import { DRAFT_STATUS_LABELS, formatNoteDate } from "@/src/lib/labels";
import { ErrorState } from "@/src/components/error-state";

type Analytics = { id: string; title: string; uniqueReaders: number; publishedAt: string | null };
export default function AnalyticsScreen() {
  const { colors } = useTheme();
  const query = useQuery({ queryKey: ["analytics"], queryFn: async () => { try { const result = await apiPage<Analytics>("/publications/mine/analytics?page=1&pageSize=25"); cacheWrite("analytics", result); return result.data; } catch (error) { const cached = cacheRead<Page<Analytics> | Analytics[]>("analytics"); if (Array.isArray(cached)) return cached; if (cached?.data) return cached.data; throw error; } } });
  return <Screen refreshing={query.isRefetching} onRefresh={() => void query.refetch()}><View style={{ gap: 6, paddingTop: 4 }}><Eyebrow>Writer analytics</Eyebrow><Title>Published notes</Title><Subtitle>Unique readers since this privacy-preserving metric began.</Subtitle></View>{query.isLoading ? [0, 1, 2].map((i) => <Card key={i} style={{ flexDirection: "row", alignItems: "center", gap: 14 }}><Skeleton style={{ width: 42, height: 42, borderRadius: 21 }} /><View style={{ flex: 1, gap: 6 }}><Skeleton style={{ width: "70%", height: 16 }} /><Skeleton style={{ width: "40%", height: 13 }} /></View></Card>) : query.data?.length ? query.data.map((item) => <Card key={item.id} style={{ flexDirection: "row", alignItems: "center", gap: 14 }}><View style={{ width: 42, height: 42, borderRadius: 21, backgroundColor: colors.iconSoft, alignItems: "center", justifyContent: "center" }}><Ionicons name="eye-outline" size={21} color={colors.brand} /></View><View style={{ flex: 1, gap: 4 }}><Text style={{ color: colors.ink, fontSize: 16, fontWeight: "700" }}>{item.title}</Text><Subtitle>{item.publishedAt ? formatNoteDate(item.publishedAt) : DRAFT_STATUS_LABELS.CHAIN_PENDING}</Subtitle></View><Text style={{ color: colors.ink, fontSize: 16, fontWeight: "700" }}>{item.uniqueReaders}</Text></Card>) : query.isError ? <ErrorState title="We couldn't load your analytics" onRetry={() => void query.refetch()} /> : <EmptyNotes title="No published notes yet" detail="Publish a note to see its unique readers here." />}</Screen>;
}
