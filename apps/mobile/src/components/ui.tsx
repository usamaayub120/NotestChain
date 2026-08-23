import type { PropsWithChildren, ReactNode } from "react";
import { useEffect, useRef } from "react";
import { AccessibilityInfo, ActivityIndicator, Animated, Pressable, RefreshControl, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { useTheme } from "@/src/lib/theme";

export function Screen({ children, refreshing, onRefresh }: PropsWithChildren<{ refreshing?: boolean; onRefresh?: () => void }>) {
  const { colors } = useTheme();
  return <ScrollView
    style={{ backgroundColor: colors.paper }}
    contentContainerStyle={[styles.screen, { backgroundColor: colors.paper }]}
    keyboardShouldPersistTaps="handled"
    refreshControl={onRefresh ? <RefreshControl refreshing={Boolean(refreshing)} onRefresh={onRefresh} tintColor={colors.brand} colors={[colors.brand]} /> : undefined}
  >{children}</ScrollView>;
}
export function Title({ children }: PropsWithChildren) { const { colors, fontScale } = useTheme(); return <Text style={[styles.title, { color: colors.ink, fontSize: 31 * fontScale }]}>{children}</Text>; }
export function Subtitle({ children }: PropsWithChildren) { const { colors, fontScale } = useTheme(); return <Text style={[styles.subtitle, { color: colors.muted, fontSize: 15 * fontScale }]}>{children}</Text>; }
export function Eyebrow({ children }: PropsWithChildren) { const { colors, fontScale } = useTheme(); return <Text style={[styles.eyebrow, { color: colors.brand, fontSize: 12 * fontScale }]}>{children}</Text>; }
export function ErrorText({ children }: PropsWithChildren) { const { colors, fontScale } = useTheme(); return <Text accessibilityRole="alert" style={[styles.error, { color: colors.danger, fontSize: 14 * fontScale }]}>{children}</Text>; }
export function Notice({ children }: PropsWithChildren) { const { colors, fontScale } = useTheme(); return <View accessibilityLiveRegion="polite" style={[styles.notice, { backgroundColor: colors.notice, borderColor: colors.noticeBorder }]}><Text style={[styles.noticeText, { color: colors.noticeText, fontSize: 15 * fontScale }]}>{children}</Text></View>; }
export function Field({ style, ...props }: React.ComponentProps<typeof TextInput>) { const { colors, fontScale } = useTheme(); return <TextInput placeholderTextColor={colors.placeholder} selectionColor={colors.brand} style={[styles.field, { borderColor: colors.border, backgroundColor: colors.surface, color: colors.ink, fontSize: 16 * fontScale }, style]} {...props} />; }
export function Action({ title, onPress, disabled, tone = "primary", icon, accessibilityRole = "button", accessibilityState, accessibilityLabel, accessibilityHint }: {
  title: string; onPress: () => void; disabled?: boolean; tone?: "primary" | "secondary" | "danger"; icon?: ReactNode;
  accessibilityRole?: "button" | "radio" | "switch"; accessibilityState?: { checked?: boolean }; accessibilityLabel?: string; accessibilityHint?: string;
}) {
  const { colors, fontScale } = useTheme();
  const background = tone === "primary" ? colors.brand : tone === "danger" ? colors.danger : colors.soft;
  const foreground = tone === "secondary" ? colors.ink : "#fff";
  return <Pressable
    accessibilityRole={accessibilityRole}
    accessibilityState={{ disabled, ...accessibilityState }}
    accessibilityLabel={accessibilityLabel}
    accessibilityHint={accessibilityHint}
    disabled={disabled}
    onPress={onPress}
    style={({ pressed }) => [styles.button, { backgroundColor: background, borderColor: tone === "secondary" ? colors.border : background, opacity: disabled ? 0.45 : pressed ? 0.82 : 1 }]}
  ><View style={styles.buttonInner}>{icon}{<Text style={[styles.buttonText, { color: foreground, fontSize: 16 * fontScale }]}>{title}</Text>}</View></Pressable>;
}
export function Loading({ label = "Loading…" }: { label?: string }) { const { colors, fontScale } = useTheme(); return <View style={[styles.center, { backgroundColor: colors.paper }]}><ActivityIndicator color={colors.brand} /><Text style={[styles.subtitle, { color: colors.muted, fontSize: 15 * fontScale }]}>{label}</Text></View>; }
export function Divider() { const { colors } = useTheme(); return <View style={[styles.divider, { backgroundColor: colors.border }]} />; }
export function Card({ children, style }: PropsWithChildren<{ style?: React.ComponentProps<typeof View>["style"] }>) { const { colors } = useTheme(); return <View style={[styles.card, { borderColor: colors.border, backgroundColor: colors.surface, shadowColor: colors.ink }, style]}>{children}</View>; }
export function Skeleton({ style }: { style?: React.ComponentProps<typeof View>["style"] }) {
  const { colors } = useTheme();
  const opacity = useRef(new Animated.Value(0.5)).current;
  useEffect(() => {
    let mounted = true;
    let loop: Animated.CompositeAnimation | null = null;
    void AccessibilityInfo.isReduceMotionEnabled().then((reduceMotion) => {
      if (!mounted || reduceMotion) return;
      loop = Animated.loop(Animated.sequence([
        Animated.timing(opacity, { toValue: 1, duration: 700, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0.5, duration: 700, useNativeDriver: true }),
      ]));
      loop.start();
    });
    return () => { mounted = false; loop?.stop(); };
  }, [opacity]);
  return <Animated.View importantForAccessibility="no-hide-descendants" style={[{ backgroundColor: colors.soft, borderRadius: 6 }, style, { opacity }]} />;
}
export const styles = StyleSheet.create({
  screen: { padding: 20, paddingBottom: 112, gap: 16, flexGrow: 1 },
  title: { fontFamily: "serif", fontSize: 31, fontWeight: "700", letterSpacing: -0.5 },
  eyebrow: { fontSize: 12, fontWeight: "700", letterSpacing: 1.25, textTransform: "uppercase" },
  subtitle: { fontSize: 15, lineHeight: 22 }, error: { fontSize: 14, fontWeight: "600", lineHeight: 20 },
  notice: { borderRadius: 12, borderWidth: 1, padding: 14 }, noticeText: { lineHeight: 21 },
  field: { borderWidth: 1, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 13, fontSize: 16, minHeight: 52 },
  button: { minHeight: 52, borderWidth: 1, borderRadius: 12, alignItems: "center", justifyContent: "center", paddingHorizontal: 16 }, buttonInner: { flexDirection: "row", alignItems: "center", gap: 8 }, buttonText: { fontWeight: "700", fontSize: 16 },
  divider: { height: StyleSheet.hairlineWidth, marginVertical: 6 }, center: { flex: 1, minHeight: 280, padding: 32, alignItems: "center", justifyContent: "center", gap: 12 }, row: { flexDirection: "row", alignItems: "center", gap: 10 },
  card: { borderWidth: 1, borderRadius: 16, padding: 16, gap: 7, shadowOpacity: 0.05, shadowRadius: 8, shadowOffset: { width: 0, height: 3 }, elevation: 1 }
});
