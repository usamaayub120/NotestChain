import { useCallback, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, router, useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Alert, Pressable, StyleSheet, Text, View } from "react-native";
import { api } from "@/src/lib/api";
import { cacheRead, cacheWrite } from "@/src/lib/offline";
import { removeDraftFromList } from "@/src/lib/drafts";
import type { Draft } from "@/src/lib/models";
import { EmptyNotes } from "@/src/components/publication";
import { Action, Card, ErrorText, Eyebrow, IconButton, Screen, Skeleton, Subtitle, Title } from "@/src/components/ui";
import { useTheme } from "@/src/lib/theme";
import { DRAFT_STATUS_LABELS, formatRelativeTime } from "@/src/lib/labels";
import { ErrorState } from "@/src/components/error-state";
import { fonts } from "@/src/lib/fonts";



const canDelete = (draft: Draft) => draft.status === "DRAFT" || draft.status === "CHANGES_REQUESTED";

export default function DraftsScreen() {
  const { colors } = useTheme();
  const [deleteError, setDeleteError] = useState<string>();
  const query = useQuery({ queryKey: ["drafts"], refetchInterval: 15_000, queryFn: async () => { try { const drafts = await api<Draft[]>("/drafts"); cacheWrite("drafts", drafts); return drafts; } catch (error) { const cached = cacheRead<Draft[]>("drafts"); if (cached) return cached; throw error; } } });
  useFocusEffect(useCallback(() => { void query.refetch(); }, [query.refetch]));

  const deleteDraft = async (draft: Draft) => {
    setDeleteError(undefined);
    try {
      await api(`/drafts/${draft.id}`, { method: "DELETE" });
      removeDraftFromList(draft.id);
    } catch (error) {
      setDeleteError(error instanceof Error ? error.message : "Could not delete this draft.");
    }
  };

  const confirmDelete = (draft: Draft) => {
    Alert.alert("Delete this draft?", `“${draft.title || "Untitled draft"}” will be permanently deleted.`, [
      { text: "Cancel", style: "cancel" },
      { text: "Delete", style: "destructive", onPress: () => { void deleteDraft(draft); } },
    ]);
  };

  return <Screen refreshing={query.isRefetching} onRefresh={() => void query.refetch()}><View style={{ gap: 6, paddingTop: 4 }}><Eyebrow>Your writing desk</Eyebrow><Title>Drafts</Title><Subtitle>Work privately until a note is ready to publish.</Subtitle></View><Action title="New draft" onPress={() => router.push("/draft/new")} icon={<Ionicons name="create-outline" size={19} color={colors.onBrand} />} />
    {deleteError && <ErrorText>{deleteError}</ErrorText>}
    {query.isLoading ? [0, 1, 2].map((i) => <Card key={i} style={{ gap: 8 }}><Skeleton style={{ width: "70%", height: 19 }} /><View style={{ flexDirection: "row", justifyContent: "space-between" }}><Skeleton style={{ width: 90, height: 13 }} /><Skeleton style={{ width: 70, height: 13 }} /></View></Card>) : query.data?.length ? query.data.map((item) => <Card key={item.id} style={{ gap: 5 }}><View style={styles.draftRow}><View style={styles.draftContent}><Link href={`/draft/${item.id}`} asChild><Pressable accessibilityRole="link" accessibilityLabel={`Open ${item.title || "untitled draft"}`} style={({ pressed }) => [styles.draftLink, pressed && styles.pressed]}><Text numberOfLines={2} style={{ color: colors.ink, fontFamily: fonts.display, fontSize: 20, lineHeight: 25 }}>{item.title || "Untitled draft"}</Text><View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}><Subtitle>{DRAFT_STATUS_LABELS[item.status]}</Subtitle><Subtitle>{formatRelativeTime(item.updatedAt)}</Subtitle></View></Pressable></Link></View>{canDelete(item) && <View style={styles.draftAction}><IconButton tone="danger" accessibilityLabel={`Delete ${item.title || "untitled draft"}`} accessibilityHint="Permanently deletes this draft" icon={<Ionicons name="trash-outline" size={20} color={colors.danger} />} onPress={() => confirmDelete(item)} /></View>}</View></Card>) : query.isError ? <ErrorState title="We couldn't load your drafts" detail="They're still here. Check your connection and try again." onRetry={() => void query.refetch()} /> : <EmptyNotes title="No drafts yet" detail="Start one while online, and it stays with you offline." />}
  </Screen>;
}

const styles = StyleSheet.create({
  draftRow: { flexDirection: "row", alignItems: "center", gap: 14 },
  draftContent: { flex: 1, minWidth: 0 },
  draftLink: { gap: 7, paddingRight: 4 },
  draftAction: { width: 56, alignItems: "flex-end", justifyContent: "center" },
  pressed: { opacity: 0.76 },
});
