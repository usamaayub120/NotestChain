import { Ionicons } from "@expo/vector-icons";
import { Link } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";
import type { Publication } from "@/src/lib/models";
import { Skeleton, styles } from "@/src/components/ui";
import { useTheme } from "@/src/lib/theme";

export function PublicationCard({ publication }: { publication: Publication }) {
  const { colors, fontScale } = useTheme();
  const byline = publication.author ? publication.author.displayName : "Anonymous";
  const date = publication.publishedAt ? new Date(publication.publishedAt).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" }) : "Publishing";
  const title = publication.title || "Untitled note";
  return <Link href={`/note/${publication.id}`} asChild><Pressable
    accessibilityRole="link"
    accessibilityLabel={`${title}, by ${byline}, ${date}`}
    style={({ pressed }) => [local.card, { borderColor: colors.border, backgroundColor: colors.surface, shadowColor: colors.ink }, pressed && local.pressed]}
  >
    <View style={local.meta}><Text style={[local.byline, { color: colors.canopy, fontSize: 13 * fontScale }]}>{byline}</Text><Text style={[local.dot, { color: colors.muted }]}>•</Text><Text style={[local.date, { color: colors.muted, fontSize: 13 * fontScale }]}>{date}</Text></View>
    <Text style={[local.title, { color: colors.ink, fontSize: 22 * fontScale }]}>{title}</Text>
    <Text numberOfLines={3} style={[styles.subtitle, { color: colors.muted, fontSize: 15 * fontScale }]}>{publication.excerpt}</Text>
    <View style={local.footer}><View style={local.tags}>{publication.tags.slice(0, 2).map((tag) => <Text key={tag} style={[local.tag, { color: colors.muted, fontSize: 13 * fontScale }]}>#{tag}</Text>)}</View><Ionicons name="arrow-forward" size={17} color={colors.brand} importantForAccessibility="no" /></View>
  </Pressable></Link>;
}

export function PublicationCardSkeleton() {
  const { colors } = useTheme();
  return <View accessibilityElementsHidden style={[local.card, { borderColor: colors.border, backgroundColor: colors.surface }]}>
    <View style={local.meta}><Skeleton style={{ width: 90, height: 12 }} /><Skeleton style={{ width: 56, height: 12 }} /></View>
    <Skeleton style={{ width: "78%", height: 21, marginTop: 3 }} />
    <Skeleton style={{ width: "100%", height: 14, marginTop: 5 }} />
    <Skeleton style={{ width: "55%", height: 14 }} />
  </View>;
}

export function EmptyNotes({ title, detail }: { title: string; detail: string }) {
  const { colors, fontScale } = useTheme();
  return <View style={[local.empty, { borderColor: colors.border, backgroundColor: colors.elevated }]}><Ionicons name="book-outline" size={28} color={colors.brand} /><Text style={[local.emptyTitle, { color: colors.ink, fontSize: 17 * fontScale }]}>{title}</Text><Text style={[styles.subtitle, local.emptyDetail, { color: colors.muted, fontSize: 15 * fontScale }]}>{detail}</Text></View>;
}

const local = StyleSheet.create({
  card: { marginBottom: 12, borderWidth: 1, borderRadius: 16, padding: 16, gap: 7, shadowOpacity: 0.05, shadowRadius: 8, shadowOffset: { width: 0, height: 3 }, elevation: 1 },
  pressed: { opacity: 0.78 }, meta: { flexDirection: "row", gap: 6, alignItems: "center" }, byline: { fontWeight: "700", fontSize: 13 }, dot: {}, date: { fontSize: 13 },
  title: { fontFamily: "serif", fontSize: 22, fontWeight: "700", lineHeight: 27 }, footer: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 2 }, tags: { flexDirection: "row", gap: 6, flex: 1 }, tag: { fontSize: 13 },
  empty: { alignItems: "center", borderWidth: 1, borderStyle: "dashed", borderRadius: 16, padding: 28, gap: 8 }, emptyTitle: { fontSize: 17, fontWeight: "700" }, emptyDetail: { textAlign: "center" },
});
