import type { PropsWithChildren } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";

export const colors = { ink: "#1c1917", muted: "#78716c", border: "#e7e5e4", paper: "#fffdf8", brand: "#44403c", danger: "#b91c1c", soft: "#f5f5f4" };

export function Screen({ children }: PropsWithChildren) { return <ScrollView contentContainerStyle={styles.screen} keyboardShouldPersistTaps="handled">{children}</ScrollView>; }
export function Title({ children }: PropsWithChildren) { return <Text style={styles.title}>{children}</Text>; }
export function Subtitle({ children }: PropsWithChildren) { return <Text style={styles.subtitle}>{children}</Text>; }
export function ErrorText({ children }: PropsWithChildren) { return <Text accessibilityRole="alert" style={styles.error}>{children}</Text>; }
export function Notice({ children }: PropsWithChildren) { return <View style={styles.notice}><Text style={styles.noticeText}>{children}</Text></View>; }
export function Field(props: React.ComponentProps<typeof TextInput>) { return <TextInput placeholderTextColor="#78716c" style={styles.field} {...props} />; }
export function Action({ title, onPress, disabled, tone = "primary" }: { title: string; onPress: () => void; disabled?: boolean; tone?: "primary" | "secondary" | "danger" }) {
  const background = tone === "primary" ? colors.brand : tone === "danger" ? colors.danger : colors.soft;
  const foreground = tone === "secondary" ? colors.ink : "#fff";
  return <Pressable accessibilityRole="button" disabled={disabled} onPress={onPress} style={({ pressed }) => [styles.button, { backgroundColor: background, opacity: disabled ? 0.45 : pressed ? 0.82 : 1 }]}><Text style={[styles.buttonText, { color: foreground }]}>{title}</Text></Pressable>;
}
export function Loading({ label = "Loading…" }: { label?: string }) { return <View style={styles.center}><ActivityIndicator color={colors.brand} /><Text style={styles.subtitle}>{label}</Text></View>; }
export function Divider() { return <View style={styles.divider} />; }
export const styles = StyleSheet.create({
  screen: { padding: 20, gap: 14, backgroundColor: colors.paper, flexGrow: 1 }, title: { fontSize: 28, fontWeight: "700", color: colors.ink }, subtitle: { fontSize: 15, color: colors.muted, lineHeight: 21 }, error: { color: colors.danger, fontSize: 14 }, notice: { backgroundColor: "#fef3c7", borderRadius: 8, padding: 12 }, noticeText: { color: "#78350f", lineHeight: 20 }, field: { borderWidth: 1, borderColor: colors.border, backgroundColor: "#fff", borderRadius: 8, padding: 12, fontSize: 16, color: colors.ink, minHeight: 48 }, button: { minHeight: 48, borderRadius: 8, alignItems: "center", justifyContent: "center", paddingHorizontal: 14 }, buttonText: { fontWeight: "700", fontSize: 16 }, divider: { height: StyleSheet.hairlineWidth, backgroundColor: colors.border, marginVertical: 4 }, center: { padding: 32, alignItems: "center", gap: 12 }, row: { flexDirection: "row", alignItems: "center", gap: 10 }, card: { borderWidth: 1, borderColor: colors.border, backgroundColor: "#fff", borderRadius: 10, padding: 14, gap: 6 }
});
