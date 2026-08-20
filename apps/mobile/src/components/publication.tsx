import { Ionicons } from "@expo/vector-icons";
import { Link } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";
import type { Publication } from "@/src/lib/models";
import { colors, styles } from "@/src/components/ui";

export function PublicationCard({ publication }: { publication: Publication }) {
  const byline = publication.author ? publication.author.displayName : "Anonymous";
  const date = publication.publishedAt ? new Date(publication.publishedAt).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" }) : "Publishing";
  return <Link href={`/note/${publication.id}`} asChild><Pressable accessibilityRole="link" style={({ pressed }) => [styles.card, local.card, pressed && local.pressed]}>
    <View style={local.meta}><Text style={local.byline}>{byline}</Text><Text style={local.dot}>•</Text><Text style={local.date}>{date}</Text></View>
    <Text style={local.title}>{publication.title || "Untitled note"}</Text>
    <Text numberOfLines={3} style={styles.subtitle}>{publication.excerpt}</Text>
    <View style={local.footer}><View style={local.tags}>{publication.tags.slice(0, 2).map((tag) => <Text key={tag} style={local.tag}>#{tag}</Text>)}</View><Ionicons name="arrow-forward" size={17} color={colors.brand} /></View>
  </Pressable></Link>;
}

export function EmptyNotes({ title, detail }: { title: string; detail: string }) {
  return <View style={local.empty}><Ionicons name="book-outline" size={28} color={colors.brand} /><Text style={local.emptyTitle}>{title}</Text><Text style={[styles.subtitle, local.emptyDetail]}>{detail}</Text></View>;
}

const local = StyleSheet.create({
  card: { marginBottom: 12 }, pressed: { opacity: 0.78 }, meta: { flexDirection: "row", gap: 6, alignItems: "center" }, byline: { color: colors.canopy, fontWeight: "800", fontSize: 13 }, dot: { color: colors.muted }, date: { color: colors.muted, fontSize: 13 },
  title: { fontFamily: "serif", fontSize: 22, fontWeight: "700", lineHeight: 27, color: colors.ink }, footer: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 2 }, tags: { flexDirection: "row", gap: 6, flex: 1 }, tag: { color: colors.muted, fontSize: 13 },
  empty: { alignItems: "center", borderWidth: 1, borderColor: colors.border, borderStyle: "dashed", borderRadius: 16, backgroundColor: colors.elevated, padding: 28, gap: 8 }, emptyTitle: { color: colors.ink, fontSize: 17, fontWeight: "800" }, emptyDetail: { textAlign: "center" },
});
