import type { PropsWithChildren, ReactNode } from "react";
import { forwardRef, useEffect, useMemo } from "react";
import { AccessibilityInfo, Animated, FlatList, Pressable, RefreshControl, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { usePathname } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { tabBarShowsOn } from "@/src/lib/tab-routes";
import { useTheme } from "@/src/lib/theme";
import { fonts } from "@/src/lib/fonts";

/**
 * Height of the bottom tab bar above its own safe-area padding. Shared with
 * mobile-navigation.tsx so the bar and the scroll padding that clears it can
 * never drift apart.
 */
export const TAB_BAR_HEIGHT = 68;
/** Floor for the bottom inset on devices that report none (older Androids). */
export const MIN_BOTTOM_INSET = 12;
/** Base gutter on every screen, mirrored in styles.screen below. */
const SCREEN_PADDING = 22;

/**
 * The one layout every screen renders through. It owns the display cutout —
 * the region a status bar, notch or punch-hole camera occupies — so no screen
 * has to think about it.
 *
 * The bottom inset is always applied. `insetTop` is only needed on the screens
 * that render without a stack header (onboarding), since the header clears the
 * top cutout for everything else. `clearsTabBar` adds room for the floating
 * bottom bar, which hides itself outside the four root routes.
 */
export function Screen({ children, refreshing, onRefresh, insetTop = false, clearsTabBar = true, fitContent = false }: PropsWithChildren<{
  refreshing?: boolean;
  onRefresh?: () => void;
  insetTop?: boolean;
  clearsTabBar?: boolean;
  /** Let long-form reading screens grow to the full height of their content. */
  fitContent?: boolean;
}>) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const pathname = usePathname();
  const padTop = SCREEN_PADDING + (insetTop ? insets.top : 0);
  // Reserve room for the tab bar only where it is actually drawn.
  // `clearsTabBar` stays as an explicit opt-out for the screens that want
  // the full height even on a root route.
  const showsTabBar = clearsTabBar && tabBarShowsOn(pathname);
  const padBottom = SCREEN_PADDING + Math.max(insets.bottom, MIN_BOTTOM_INSET) + (showsTabBar ? TAB_BAR_HEIGHT : 0);
  return <ScrollView
    style={{ backgroundColor: colors.paper }}
    contentContainerStyle={[styles.screen, !fitContent && styles.screenFill, { backgroundColor: colors.paper, paddingTop: padTop, paddingBottom: padBottom }]}
    contentInsetAdjustmentBehavior="automatic"
    keyboardShouldPersistTaps="handled"
    showsVerticalScrollIndicator={false}
    refreshControl={onRefresh ? <RefreshControl refreshing={Boolean(refreshing)} onRefresh={onRefresh} tintColor={colors.brand} colors={[colors.brand]} /> : undefined}
  >{children}</ScrollView>;
}
/**
 * A feed that actually scrolls to the end of its data.
 *
 * Every list in the app was `.map()` inside `Screen`'s ScrollView: no
 * virtualization (Explore mounted and kept 50 full cards resident), and a
 * hard stop at the first page with no end-of-list marker and no way to load
 * more. Explore displayed `meta.total` while doing it, so the app told the
 * reader there were 300 notes and then showed 50 of them.
 *
 * Keeps Screen's contract -  same gutter, same safe-area handling, same
 * tab-bar clearance, same pull-to-refresh -  so a screen can move across
 * without changing how it looks.
 */
export function ListScreen<T>({
  data,
  renderItem,
  keyExtractor,
  header,
  empty,
  footer,
  refreshing,
  onRefresh,
  onEndReached,
  clearsTabBar = true,
}: {
  data: readonly T[];
  renderItem: (item: T) => ReactNode;
  keyExtractor: (item: T) => string;
  header?: ReactNode;
  empty?: ReactNode;
  footer?: ReactNode;
  refreshing?: boolean;
  onRefresh?: () => void;
  onEndReached?: () => void;
  clearsTabBar?: boolean;
}) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const pathname = usePathname();
  const showsTabBar = clearsTabBar && tabBarShowsOn(pathname);
  const padBottom = SCREEN_PADDING + Math.max(insets.bottom, MIN_BOTTOM_INSET) + (showsTabBar ? TAB_BAR_HEIGHT : 0);

  return (
    <FlatList
      data={data as T[]}
      keyExtractor={keyExtractor}
      renderItem={({ item }) => <>{renderItem(item)}</>}
      style={{ backgroundColor: colors.paper }}
      contentContainerStyle={{ padding: SCREEN_PADDING, gap: 18, paddingTop: SCREEN_PADDING, paddingBottom: padBottom, flexGrow: 1 }}
      ListHeaderComponent={header ? <View style={{ gap: 18 }}>{header}</View> : null}
      ListEmptyComponent={empty ? <>{empty}</> : null}
      ListFooterComponent={footer ? <>{footer}</> : null}
      onEndReached={onEndReached}
      // Early enough that the next page is usually there before the reader
      // reaches the bottom, late enough not to fetch page 2 on first paint.
      onEndReachedThreshold={0.6}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
      refreshControl={onRefresh ? <RefreshControl refreshing={Boolean(refreshing)} onRefresh={onRefresh} tintColor={colors.brand} colors={[colors.brand]} /> : undefined}
    />
  );
}

export function Title({ children }: PropsWithChildren) { const { colors, fontScale } = useTheme(); return <Text style={[styles.title, { color: colors.ink, fontSize: 31 * fontScale }]}>{children}</Text>; }
/** `live` makes the text an announced region, for status that changes
 *  without anything moving focus -  the autosave indicator above all. */
export function Subtitle({ children, live }: PropsWithChildren<{ live?: boolean }>) { const { colors, fontScale } = useTheme(); return <Text accessibilityLiveRegion={live ? "polite" : "none"} style={[styles.subtitle, { color: colors.muted, fontSize: 15 * fontScale }]}>{children}</Text>; }
export function Eyebrow({ children }: PropsWithChildren) { const { colors, fontScale } = useTheme(); return <Text style={[styles.eyebrow, { color: colors.brand, fontSize: 12 * fontScale }]}>{children}</Text>; }
export function ErrorText({ children }: PropsWithChildren) { const { colors, fontScale } = useTheme(); return <Text accessibilityRole="alert" style={[styles.error, { color: colors.danger, fontSize: 14 * fontScale }]}>{children}</Text>; }
export function Notice({ children }: PropsWithChildren) { const { colors, fontScale } = useTheme(); return <View accessibilityLiveRegion="polite" style={[styles.notice, { backgroundColor: colors.notice, borderColor: colors.noticeBorder }]}><Text style={[styles.noticeText, { color: colors.noticeText, fontSize: 15 * fontScale }]}>{children}</Text></View>; }
export const Field = forwardRef<TextInput, React.ComponentProps<typeof TextInput>>(function Field({ style, ...props }, ref) { const { colors, fontScale } = useTheme(); return <TextInput ref={ref} placeholderTextColor={colors.placeholder} selectionColor={colors.brand} style={[styles.field, { borderColor: colors.border, backgroundColor: colors.surface, color: colors.ink, fontSize: 16 * fontScale }, style]} {...props} />; });
export function Action({ title, onPress, disabled, tone = "primary", icon, accessibilityRole = "button", accessibilityState, accessibilityLabel, accessibilityHint }: {
  title: string; onPress: () => void; disabled?: boolean; tone?: "primary" | "secondary" | "danger"; icon?: ReactNode;
  accessibilityRole?: "button" | "radio" | "switch"; accessibilityState?: { checked?: boolean }; accessibilityLabel?: string; accessibilityHint?: string;
}) {
  const { colors, fontScale } = useTheme();
  const background = disabled ? colors.soft : tone === "primary" ? colors.brand : tone === "danger" ? colors.danger : colors.soft;
  // colors.onBrand, not "#fff": in dark mode the accent is brighter and
  // carries DARK text. White here measured 2.6:1 on every filled CTA.
  const foreground = disabled ? colors.muted : tone === "secondary" ? colors.ink : colors.onBrand;
  const border = disabled ? colors.border : tone === "secondary" ? colors.border : background;
  return <Pressable
    accessibilityRole={accessibilityRole}
    accessibilityState={{ disabled, ...accessibilityState }}
    accessibilityLabel={accessibilityLabel}
    accessibilityHint={accessibilityHint}
    disabled={disabled}
    onPress={onPress}
    style={({ pressed }) => [styles.button, { backgroundColor: background, borderColor: border, opacity: pressed ? 0.84 : 1, transform: [{ scale: pressed ? 0.985 : 1 }] }]}
  ><View style={styles.buttonInner}>
    {/* §14: never rely on colour alone. Selection in the byline picker, the
        visibility choice and the Following/Latest switch was carried by fill
        colour and nothing else -  so "which byline am I publishing under"
        was answered purely by hue. The check is the non-colour signal. */}
    {accessibilityRole === "radio" && accessibilityState?.checked ? (
      <Ionicons name="checkmark" size={17} color={foreground} />
    ) : null}
    {icon}
    <Text style={[styles.buttonText, { color: foreground, fontSize: 16 * fontScale }]}>{title}</Text>
  </View></Pressable>;
}
/**
 * Icon-only control. The label does not disappear when the text does — it
 * moves to accessibilityLabel, which is required for exactly that reason.
 * Hit area is a fixed 44x44 (DESIGN_SYSTEM.md §14) regardless of glyph size.
 */
export function IconButton({ icon, accessibilityLabel, onPress, disabled, tone = "secondary", accessibilityRole = "button", accessibilityState, accessibilityHint }: {
  icon: ReactNode; accessibilityLabel: string; onPress: () => void; disabled?: boolean;
  tone?: "plain" | "secondary" | "primary" | "danger";
  accessibilityRole?: "button" | "switch"; accessibilityState?: { checked?: boolean }; accessibilityHint?: string;
}) {
  const { colors } = useTheme();
  const background = tone === "primary" ? colors.brand : tone === "danger" ? colors.iconSoft : tone === "secondary" ? colors.soft : "transparent";
  const border = tone === "plain" ? "transparent" : tone === "primary" ? colors.brand : tone === "danger" ? colors.iconSoft : colors.border;
  return <Pressable
    accessibilityRole={accessibilityRole}
    accessibilityLabel={accessibilityLabel}
    accessibilityHint={accessibilityHint}
    accessibilityState={{ disabled, ...accessibilityState }}
    disabled={disabled}
    onPress={onPress}
    style={({ pressed }) => [styles.iconButton, { backgroundColor: background, borderColor: border, opacity: disabled ? 0.45 : pressed ? 0.76 : 1, transform: [{ scale: pressed ? 0.96 : 1 }] }]}
  >{icon}</Pressable>;
}

/**
 * Native counterpart to the web writing-mark loader. A spinner is reserved
 * for neither NotesChain's proof mark nor its reading/writing experience, so
 * loading is communicated with three hand-written strokes instead.
 */
export function Loading({ label = "Loading…" }: { label?: string }) {
  const { colors } = useTheme();
  const opacity = useMemo(() => new Animated.Value(1), []);

  useEffect(() => {
    let mounted = true;
    let loop: Animated.CompositeAnimation | null = null;
    void AccessibilityInfo.isReduceMotionEnabled().then((reduceMotion) => {
      if (!mounted || reduceMotion) return;
      loop = Animated.loop(Animated.sequence([
        Animated.timing(opacity, { toValue: 0.55, duration: 700, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 1, duration: 700, useNativeDriver: true }),
      ]));
      loop.start();
    });
    return () => { mounted = false; loop?.stop(); };
  }, [opacity]);

  return <View accessibilityRole="progressbar" accessibilityLabel={label} style={[styles.center, { backgroundColor: colors.paper }]}>
    <Animated.View importantForAccessibility="no-hide-descendants" style={[styles.writingMark, { opacity }]}>
      <View style={[styles.writingStroke, { width: 70, backgroundColor: colors.muted, transform: [{ rotate: "-1deg" }] }]} />
      <View style={[styles.writingStroke, { width: 54, backgroundColor: colors.muted, transform: [{ rotate: "1deg" }] }]} />
      <View style={[styles.writingStroke, { width: 34, backgroundColor: colors.muted, transform: [{ rotate: "-1deg" }] }]} />
    </Animated.View>
  </View>;
}
export function Divider() { const { colors } = useTheme(); return <View style={[styles.divider, { backgroundColor: colors.border }]} />; }
export function Card({ children, style }: PropsWithChildren<{ style?: React.ComponentProps<typeof View>["style"] }>) { const { colors } = useTheme(); return <View style={[styles.card, { borderColor: colors.border, backgroundColor: colors.surface }, style]}>{children}</View>; }
export function Skeleton({ style }: { style?: React.ComponentProps<typeof View>["style"] }) {
  const { colors } = useTheme();
  const opacity = useMemo(() => new Animated.Value(0.5), []);
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
  screen: { padding: SCREEN_PADDING, gap: 18 },
  screenFill: { flexGrow: 1 },
  title: { fontFamily: fonts.display, fontSize: 31, letterSpacing: -0.8, lineHeight: 37 },
  eyebrow: { fontFamily: fonts.bold, fontSize: 12, letterSpacing: 1.25, textTransform: "uppercase" },
  subtitle: { fontFamily: fonts.body, fontSize: 15, lineHeight: 22 }, error: { fontFamily: fonts.semibold, fontSize: 14, lineHeight: 20 },
  notice: { borderRadius: 12, borderWidth: 1, padding: 14 }, noticeText: { fontFamily: fonts.body, lineHeight: 21 },
  field: { fontFamily: fonts.body, borderWidth: 1, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 13, fontSize: 16, minHeight: 52 },
  button: { minHeight: 52, borderWidth: 1, borderRadius: 12, alignItems: "center", justifyContent: "center", paddingHorizontal: 16 }, buttonInner: { flexDirection: "row", alignItems: "center", gap: 8 }, buttonText: { fontFamily: fonts.bold, fontSize: 16 },
  iconButton: { width: 44, height: 44, borderWidth: 1, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  divider: { height: StyleSheet.hairlineWidth, marginVertical: 6 }, center: { flex: 1, minHeight: 280, padding: 32, alignItems: "center", justifyContent: "center" }, writingMark: { width: 72, height: 32, justifyContent: "space-between", alignItems: "flex-start" }, writingStroke: { height: 2, borderRadius: 99 }, row: { flexDirection: "row", alignItems: "center", gap: 10 },
  card: { borderWidth: 1, borderRadius: 16, padding: 16, gap: 7, boxShadow: "0 5px 14px rgba(32, 30, 27, 0.055)" }
});
