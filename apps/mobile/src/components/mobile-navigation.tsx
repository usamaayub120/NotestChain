import { Ionicons } from "@expo/vector-icons";
import { Link, usePathname } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { colors } from "@/src/components/ui";

const items = [
  { href: "/" as const, label: "Home", icon: "home-outline" as const, activeIcon: "home" as const },
  { href: "/explore" as const, label: "Explore", icon: "compass-outline" as const, activeIcon: "compass" as const },
  { href: "/search" as const, label: "Search", icon: "search-outline" as const, activeIcon: "search" as const },
  { href: "/account" as const, label: "Account", icon: "person-circle-outline" as const, activeIcon: "person-circle" as const },
];

export function MobileNavigation() {
  const pathname = usePathname();
  if (!items.some((item) => item.href === pathname)) return null;
  return <View accessibilityRole="tablist" style={local.bar}>{items.map((item) => {
    const active = pathname === item.href;
    return <Link key={item.href} href={item.href} asChild><Pressable accessibilityRole="tab" accessibilityState={{ selected: active }} style={({ pressed }) => [local.item, pressed && local.pressed]}>
      <Ionicons name={active ? item.activeIcon : item.icon} size={22} color={active ? colors.brand : colors.muted} />
      <Text style={[local.label, active && local.activeLabel]}>{item.label}</Text>
    </Pressable></Link>;
  })}</View>;
}

const local = StyleSheet.create({
  bar: { position: "absolute", bottom: 0, left: 0, right: 0, minHeight: 72, paddingHorizontal: 8, paddingTop: 8, paddingBottom: 12, flexDirection: "row", borderTopWidth: 1, borderColor: colors.border, backgroundColor: "#f6f1e8", shadowColor: colors.ink, shadowOpacity: 0.08, shadowRadius: 12, shadowOffset: { width: 0, height: -3 }, elevation: 10 },
  item: { flex: 1, alignItems: "center", justifyContent: "center", gap: 3, borderRadius: 10 }, pressed: { opacity: 0.72 }, label: { color: colors.muted, fontSize: 11, fontWeight: "700" }, activeLabel: { color: colors.brand },
});
