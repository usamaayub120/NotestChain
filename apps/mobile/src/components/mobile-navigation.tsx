import { Ionicons } from "@expo/vector-icons";
import { router, usePathname } from "expo-router";
import { Keyboard, Pressable, StyleSheet, Text, View } from "react-native";
import { useEffect, useState } from "react";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { MIN_BOTTOM_INSET, TAB_BAR_HEIGHT } from "@/src/components/ui";
import { useTheme } from "@/src/lib/theme";
import { tabBarShowsOn } from "@/src/lib/tab-routes";

const items = [
  { href: "/" as const, label: "Home", icon: "home-outline" as const, activeIcon: "home" as const },
  { href: "/explore" as const, label: "Explore", icon: "compass-outline" as const, activeIcon: "compass" as const },
  { href: "/search" as const, label: "Search", icon: "search-outline" as const, activeIcon: "search" as const },
  { href: "/account" as const, label: "Account", icon: "person-circle-outline" as const, activeIcon: "person-circle" as const },
];

export function MobileNavigation() {
  const { colors } = useTheme();
  const pathname = usePathname();
  const insets = useSafeAreaInsets();
  const [keyboardOpen, setKeyboardOpen] = useState(false);

  useEffect(() => {
    const show = Keyboard.addListener("keyboardDidShow", () => setKeyboardOpen(true));
    const hide = Keyboard.addListener("keyboardDidHide", () => setKeyboardOpen(false));
    return () => { show.remove(); hide.remove(); };
  }, []);

  if (keyboardOpen || !tabBarShowsOn(pathname)) return null;
  return <View accessibilityRole="tablist" style={[local.bar, { borderColor: colors.border, backgroundColor: colors.paper, paddingBottom: Math.max(insets.bottom, MIN_BOTTOM_INSET), minHeight: TAB_BAR_HEIGHT + Math.max(insets.bottom, MIN_BOTTOM_INSET) }]}>{items.map((item) => {
    const active = pathname === item.href;
    return <Pressable key={item.href} accessibilityRole="tab" accessibilityLabel={item.label} accessibilityState={{ selected: active }} onPress={() => router.replace(item.href)} style={({ pressed }) => [local.item, { backgroundColor: active ? colors.soft : "transparent" }, pressed && local.pressed]}>
      <Ionicons name={active ? item.activeIcon : item.icon} size={22} color={active ? colors.brand : colors.muted} />
      <Text style={[local.label, { color: active ? colors.brand : colors.muted }]}>{item.label}</Text>
    </Pressable>;
  })}</View>;
}

const local = StyleSheet.create({
  bar: { position: "absolute", bottom: 0, left: 0, right: 0, paddingHorizontal: 8, paddingTop: 8, flexDirection: "row", alignItems: "stretch", borderTopWidth: 1, boxShadow: "0 -3px 12px rgba(32, 30, 27, 0.08)" },
  item: { width: "25%", minWidth: 0, minHeight: 48, alignItems: "center", justifyContent: "center", gap: 3, borderRadius: 12 }, pressed: { opacity: 0.76 }, label: { fontSize: 12, fontWeight: "700", lineHeight: 15, textAlign: "center" },
});
