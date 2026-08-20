import { Stack } from "expo-router";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useEffect } from "react";
import { View } from "react-native";
import NetInfo from "@react-native-community/netinfo";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { initialiseOfflineStore } from "@/src/lib/offline";
import { syncQueuedMutations } from "@/src/lib/sync";
import { MobileNavigation } from "@/src/components/mobile-navigation";
import { colors } from "@/src/components/ui";

const client = new QueryClient();

export default function RootLayout() {
  // Initialise synchronously so a first feed request can never race the cache schema.
  initialiseOfflineStore();
  useEffect(() => {
    void syncQueuedMutations();
    return NetInfo.addEventListener((state) => { if (state.isConnected) void syncQueuedMutations(); });
  }, []);
  return <SafeAreaProvider><QueryClientProvider client={client}><View style={{ flex: 1, backgroundColor: colors.paper }}><Stack screenOptions={{ headerBackTitle: "Back", headerTintColor: colors.brand, headerStyle: { backgroundColor: colors.paper }, headerTitleStyle: { color: colors.ink, fontWeight: "800" }, headerShadowVisible: false, contentStyle: { backgroundColor: colors.paper } }}>
    <Stack.Screen name="index" options={{ headerShown: false }} />
    <Stack.Screen name="explore" options={{ title: "Explore" }} />
    <Stack.Screen name="search" options={{ title: "Search" }} />
    <Stack.Screen name="account" options={{ title: "Account" }} />
    <Stack.Screen name="drafts" options={{ title: "Your drafts" }} />
  </Stack><MobileNavigation /></View></QueryClientProvider></SafeAreaProvider>;
}
