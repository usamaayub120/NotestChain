import { Ionicons } from "@expo/vector-icons";
import { router, usePathname } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors } from "@/src/components/ui";

const items = [
  { href: "/" as const, label: "Home", icon: "home-outline" as const, activeIcon: "home" as const },
  { href: "/explore" as const, label: "Explore", icon: "compass-outline" as const, activeIcon: "compass" as const },
  { href: "/search" as const, label: "Search", icon: "search-outline" as const, activeIcon: "search" as const },
  { href: "/account" as const, label: "Account", icon: "person-circle-outline" as const, activeIcon: "person-circle" as const },
];

export function MobileNavigation() {
  const pathname = usePathname();
  const insets = useSafeAreaInsets();
  if (!items.some((item) => item.href === pathname)) return null;
  return <View accessibilityRole="tablist" style={[local.bar, { paddingBottom: Math.max(insets.bottom, 12), minHeight: 60 + Math.max(insets.bottom, 12) }]}>{items.map((item) => {
    const active = pathname === item.href;
    return <Pressable key={item.href} accessibilityRole="tab" accessibilityState={{ selected: active }} onPress={() => router.replace(item.href)} style={({ pressed }) => [local.item, pressed && local.pressed]}>
      <Ionicons name={active ? item.activeIcon : item.icon} size={22} color={active ? colors.brand : colors.muted} />
      <Text style={[local.label, active && local.activeLabel]}>{item.label}</Text>
    </Pressable>;
  })}</View>;
}

const local = StyleSheet.create({
  bar: { position: "absolute", bottom: 0, left: 0, right: 0, paddingHorizontal: 6, paddingTop: 7, flexDirection: "row", alignItems: "stretch", borderTopWidth: 1, borderColor: colors.border, backgroundColor: "#f6f1e8", shadowColor: colors.ink, shadowOpacity: 0.08, shadowRadius: 12, shadowOffset: { width: 0, height: -3 }, elevation: 10 },
  item: { width: "25%", minWidth: 0, alignItems: "center", justifyContent: "center", gap: 3, borderRadius: 10 }, pressed: { opacity: 0.72 }, label: { color: colors.muted, fontSize: 10, fontWeight: "700", lineHeight: 13, textAlign: "center" }, activeLabel: { color: colors.brand },
});
