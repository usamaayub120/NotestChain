import { Stack } from "expo-router";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { AppState, Pressable, Text, View } from "react-native";
import NetInfo from "@react-native-community/netinfo";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { initialiseOfflineStore } from "@/src/lib/offline";
import { syncQueuedMutations } from "@/src/lib/sync";
import { MobileNavigation } from "@/src/components/mobile-navigation";
import { AppLockGate } from "@/src/components/app-lock-gate";
import { hasPinSet } from "@/src/lib/app-lock";
import { ThemeProvider, useTheme } from "@/src/lib/theme";

/**
 * Route-level ErrorBoundary export (expo-router convention) — the fallback
 * for any screen that doesn't define its own. Deliberately does not use
 * useTheme()/ui.tsx: if ThemeProvider itself is what failed, this must still
 * render on its own.
 */
export function ErrorBoundary({ retry }: { error: Error; retry: () => void }) {
  return <View style={{ flex: 1, alignItems: "center", justifyContent: "center", gap: 12, padding: 32, backgroundColor: "#f6f1e8" }}>
    <Text style={{ fontSize: 20, fontWeight: "700", color: "#201e1b" }}>Something went wrong</Text>
    <Text style={{ fontSize: 15, color: "#6f695d", textAlign: "center" }}>NotesChain is still running. Try that again.</Text>
    <Pressable accessibilityRole="button" onPress={retry} style={{ backgroundColor: "#e1502f", borderRadius: 12, paddingHorizontal: 20, paddingVertical: 14 }}>
      <Text style={{ color: "#fff", fontWeight: "700" }}>Try again</Text>
    </Pressable>
  </View>;
}

const client = new QueryClient();

export default function RootLayout() {
  // Initialise synchronously so a first feed request can never race the cache schema.
  initialiseOfflineStore();
  const [pinSet, setPinSet] = useState<boolean | null>(null);
  const [locked, setLocked] = useState(false);

  useEffect(() => {
    void hasPinSet().then((isSet) => { setPinSet(isSet); setLocked(isSet); });
  }, []);

  useEffect(() => {
    void syncQueuedMutations();
    return NetInfo.addEventListener((state) => { if (state.isConnected) void syncQueuedMutations(); });
  }, []);

  useEffect(() => {
    // Re-check on every foreground transition (rather than trusting a
    // captured pinSet flag) so turning app lock on/off from Settings takes
    // effect immediately without needing a restart.
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active") void hasPinSet().then((isSet) => { if (isSet) setLocked(true); });
    });
    return () => sub.remove();
  }, []);

  return <SafeAreaProvider><QueryClientProvider client={client}><ThemeProvider>
    {pinSet === null ? null : locked ? <AppLockGate onUnlock={() => setLocked(false)} /> : <AppNavigator />}
  </ThemeProvider></QueryClientProvider></SafeAreaProvider>;
}

function AppNavigator() {
  const { colors } = useTheme();
  return <View style={{ flex: 1, backgroundColor: colors.paper }}><Stack screenOptions={{ headerBackTitle: "Back", headerTintColor: colors.brand, headerStyle: { backgroundColor: colors.paper }, headerTitleStyle: { color: colors.ink, fontWeight: "700" }, headerShadowVisible: false, contentStyle: { backgroundColor: colors.paper } }}>
    <Stack.Screen name="index" options={{ headerShown: false }} />
    <Stack.Screen name="onboarding" options={{ headerShown: false, gestureEnabled: false }} />
    <Stack.Screen name="explore" options={{ title: "Explore" }} />
    <Stack.Screen name="search" options={{ title: "Search" }} />
    <Stack.Screen name="verify" options={{ title: "Verify a note" }} />
    <Stack.Screen name="account" options={{ title: "Account" }} />
    <Stack.Screen name="drafts" options={{ title: "Your drafts" }} />
    <Stack.Screen name="draft/new" options={{ title: "New draft" }} />
    <Stack.Screen name="draft/[id]" options={{ title: "Edit draft" }} />
    <Stack.Screen name="note/[id]" options={{ title: "Note" }} />
    <Stack.Screen name="profile/[username]" options={{ title: "Profile" }} />
    <Stack.Screen name="analytics" options={{ title: "Published notes" }} />
    <Stack.Screen name="bookmarks" options={{ title: "Saved notes" }} />
    <Stack.Screen name="identities/index" options={{ title: "Public identities" }} />
    <Stack.Screen name="identities/new" options={{ title: "New identity" }} />
    <Stack.Screen name="register" options={{ title: "Create account" }} />
    <Stack.Screen name="forgot-password" options={{ title: "Reset password" }} />
    <Stack.Screen name="reset-password" options={{ title: "Choose password" }} />
    <Stack.Screen name="settings/index" options={{ title: "Settings" }} />
    <Stack.Screen name="settings/app-lock" options={{ title: "App lock" }} />
  </Stack><MobileNavigation /></View>;
}
