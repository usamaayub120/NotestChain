import type { PropsWithChildren, ReactNode } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";

export const colors = {
  ink: "#201e1b", muted: "#6f695d", border: "#ddd5c4", paper: "#f6f1e8", surface: "#ffffff", elevated: "#fbf8f2",
  brand: "#e1502f", canopy: "#1f3327", glow: "#f0c48b", danger: "#c4361f", soft: "#ede7db", success: "#3f6b4c",
};

export function Screen({ children }: PropsWithChildren) { return <ScrollView contentContainerStyle={styles.screen} keyboardShouldPersistTaps="handled">{children}</ScrollView>; }
export function Title({ children }: PropsWithChildren) { return <Text style={styles.title}>{children}</Text>; }
export function Subtitle({ children }: PropsWithChildren) { return <Text style={styles.subtitle}>{children}</Text>; }
export function Eyebrow({ children }: PropsWithChildren) { return <Text style={styles.eyebrow}>{children}</Text>; }
export function ErrorText({ children }: PropsWithChildren) { return <Text accessibilityRole="alert" style={styles.error}>{children}</Text>; }
export function Notice({ children }: PropsWithChildren) { return <View style={styles.notice}><Text style={styles.noticeText}>{children}</Text></View>; }
export function Field(props: React.ComponentProps<typeof TextInput>) { return <TextInput placeholderTextColor="#78716c" style={styles.field} {...props} />; }
export function Action({ title, onPress, disabled, tone = "primary", icon }: { title: string; onPress: () => void; disabled?: boolean; tone?: "primary" | "secondary" | "danger"; icon?: ReactNode }) {
  const background = tone === "primary" ? colors.brand : tone === "danger" ? colors.danger : colors.soft;
  const foreground = tone === "secondary" ? colors.ink : "#fff";
  return <Pressable accessibilityRole="button" disabled={disabled} onPress={onPress} style={({ pressed }) => [styles.button, { backgroundColor: background, borderColor: tone === "secondary" ? colors.border : background, opacity: disabled ? 0.45 : pressed ? 0.82 : 1 }]}><View style={styles.buttonInner}>{icon}{<Text style={[styles.buttonText, { color: foreground }]}>{title}</Text>}</View></Pressable>;
}
export function Loading({ label = "Loading…" }: { label?: string }) { return <View style={styles.center}><ActivityIndicator color={colors.brand} /><Text style={styles.subtitle}>{label}</Text></View>; }
export function Divider() { return <View style={styles.divider} />; }
export const styles = StyleSheet.create({
  screen: { padding: 20, paddingBottom: 112, gap: 16, backgroundColor: colors.paper, flexGrow: 1 },
  title: { fontFamily: "serif", fontSize: 31, fontWeight: "700", letterSpacing: -0.5, color: colors.ink },
  eyebrow: { color: colors.brand, fontSize: 12, fontWeight: "800", letterSpacing: 1.25, textTransform: "uppercase" },
  subtitle: { fontSize: 15, color: colors.muted, lineHeight: 22 }, error: { color: colors.danger, fontSize: 14, fontWeight: "600", lineHeight: 20 },
  notice: { backgroundColor: "#fff5de", borderRadius: 12, borderWidth: 1, borderColor: "#edd6a7", padding: 14 }, noticeText: { color: "#765016", lineHeight: 21 },
  field: { borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 13, fontSize: 16, color: colors.ink, minHeight: 52 },
  button: { minHeight: 52, borderWidth: 1, borderRadius: 12, alignItems: "center", justifyContent: "center", paddingHorizontal: 16 }, buttonInner: { flexDirection: "row", alignItems: "center", gap: 8 }, buttonText: { fontWeight: "800", fontSize: 16 },
  divider: { height: StyleSheet.hairlineWidth, backgroundColor: colors.border, marginVertical: 6 }, center: { flex: 1, minHeight: 280, backgroundColor: colors.paper, padding: 32, alignItems: "center", justifyContent: "center", gap: 12 }, row: { flexDirection: "row", alignItems: "center", gap: 10 },
  card: { borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, borderRadius: 16, padding: 16, gap: 7, shadowColor: colors.ink, shadowOpacity: 0.05, shadowRadius: 8, shadowOffset: { width: 0, height: 3 }, elevation: 1 }
});
