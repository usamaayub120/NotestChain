import { Stack, router } from "expo-router";
import { QueryClientProvider } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { AppState, Pressable, Text, View } from "react-native";
import NetInfo from "@react-native-community/netinfo";
import * as Notifications from "expo-notifications";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { initialiseOfflineStore } from "@/src/lib/offline";
import { syncQueuedMutations } from "@/src/lib/sync";
import { syncPushRegistration } from "@/src/lib/push";
import { MobileNavigation } from "@/src/components/mobile-navigation";
import { HeaderAddButton, HeaderBrand } from "@/src/components/app-header";
import { AppLockGate } from "@/src/components/app-lock-gate";
import { hasPinSet } from "@/src/lib/app-lock";
import { ThemeProvider, useTheme } from "@/src/lib/theme";
import { queryClient } from "@/src/lib/query-client";
import { Loading } from "@/src/components/ui";
import { AppUpdateGate } from "@/src/components/app-update-gate";
import { useAppVersionCheck } from "@/src/hooks/use-app-version-check";
import { setUnauthorizedHandler } from "@/src/lib/api";

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

export default function RootLayout() {
  // Initialise synchronously so a first feed request can never race the cache schema.
  initialiseOfflineStore();

  return <SafeAreaProvider><QueryClientProvider client={queryClient}><ThemeProvider><AppShell /></ThemeProvider></QueryClientProvider></SafeAreaProvider>;
}

function AppShell() {
  const [pinSet, setPinSet] = useState<boolean | null>(null);
  const [locked, setLocked] = useState(false);
  const versionCheck = useAppVersionCheck();
  const appMayRun = versionCheck.status !== "checking" && versionCheck.status !== "required";

  useEffect(() => setUnauthorizedHandler(() => {
    // An expired bearer credential must not leave a protected screen showing
    // a generic network error. Its cached private data is discarded before
    // returning to the mobile sign-in screen.
    queryClient.clear();
    router.replace("/account");
  }), []);

  useEffect(() => {
    if (!appMayRun) return;
    void hasPinSet().then((isSet) => { setPinSet(isSet); setLocked(isSet); });
  }, [appMayRun]);

  useEffect(() => {
    if (!appMayRun) return;
    void syncQueuedMutations();
    return NetInfo.addEventListener((state) => { if (state.isConnected) void syncQueuedMutations(); });
  }, [appMayRun]);

  useEffect(() => {
    if (!appMayRun) return;
    // Re-check on every foreground transition (rather than trusting a
    // captured pinSet flag) so turning app lock on/off from Settings takes
    // effect immediately without needing a restart.
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active") void hasPinSet().then((isSet) => { if (isSet) setLocked(true); });
    });
    return () => sub.remove();
  }, [appMayRun]);

  useEffect(() => {
    if (!appMayRun) return;
    // Same event, same reasoning as the app-lock re-check above: a fresh
    // sign-in doesn't remount this layout, so registration has to happen on
    // every foreground transition, not just once at cold start. The upsert
    // on the server means a redundant call here is harmless.
    void syncPushRegistration();
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active") void syncPushRegistration();
    });
    return () => sub.remove();
  }, [appMayRun]);

  useEffect(() => {
    if (!appMayRun) return;
    // A push notification tapped from the tray (app backgrounded or killed)
    // opens the screen its payload points at — see packages/push's
    // RenderedPush.deepLink, an expo-router path resolved the same way a
    // noteschain:// deep link is.
    const sub = Notifications.addNotificationResponseReceivedListener((response) => {
      const deepLink = response.notification.request.content.data?.deepLink;
      if (typeof deepLink === "string") router.push(deepLink as never);
    });
    return () => sub.remove();
  }, [appMayRun]);

  if (versionCheck.status === "checking") return <Loading label="Checking for updates…" />;
  if (versionCheck.status === "required" && versionCheck.config) {
    return <AppUpdateGate status="required" config={versionCheck.config} onLater={() => undefined} />;
  }
  if (pinSet === null) return <Loading label="Loading NotesChain…" />;

  return <>
    {locked ? <AppLockGate onUnlock={() => setLocked(false)} /> : <AppNavigator />}
    {versionCheck.status === "optional" && versionCheck.config && !versionCheck.optionalPromptDismissed ? (
      <AppUpdateGate status="optional" config={versionCheck.config} onLater={versionCheck.dismissOptionalPrompt} />
    ) : null}
  </>;
}

/**
 * The four bottom-tab destinations show the brand lockup rather than a screen
 * title — the tab bar already names them, and this is the "logo + app name on
 * the left" top bar. Every other screen keeps the stack's back button and its
 * own title in that slot.
 */
const ROOT_SCREEN = { headerTitle: "", headerLeft: () => <HeaderBrand /> } as const;

function AppNavigator() {
  const { colors } = useTheme();
  return <View style={{ flex: 1, backgroundColor: colors.paper }}><Stack screenOptions={{ headerBackTitle: "Back", headerTintColor: colors.brand, headerTransparent: false, headerStyle: { backgroundColor: colors.paper }, headerTitleStyle: { color: colors.ink, fontWeight: "700" }, headerShadowVisible: false, contentStyle: { backgroundColor: colors.paper }, headerRight: () => <HeaderAddButton /> }}>
    <Stack.Screen name="index" options={ROOT_SCREEN} />
    <Stack.Screen name="onboarding" options={{ headerShown: false, gestureEnabled: false }} />
    <Stack.Screen name="explore" options={ROOT_SCREEN} />
    <Stack.Screen name="search" options={ROOT_SCREEN} />
    <Stack.Screen name="verify" options={{ title: "Verify" }} />
    <Stack.Screen name="account" options={{ ...ROOT_SCREEN, headerRight: () => null }} />
    <Stack.Screen name="drafts" options={{ title: "Your drafts" }} />
    <Stack.Screen name="draft/new" options={{ title: "New draft" }} />
    <Stack.Screen name="draft/[id]" options={{ title: "Edit draft" }} />
    <Stack.Screen name="note/[id]" options={{ title: "Note" }} />
    <Stack.Screen name="profile/[username]" options={{ title: "Profile" }} />
    <Stack.Screen name="analytics" options={{ title: "Published notes" }} />
    <Stack.Screen name="bookmarks" options={{ title: "Saved notes" }} />
    <Stack.Screen name="identities/index" options={{ title: "Your bylines" }} />
    <Stack.Screen name="identities/new" options={{ title: "New pen name" }} />
    <Stack.Screen name="identities/[id]" options={{ title: "Edit" }} />
    <Stack.Screen name="register" options={{ headerShown: false }} />
    <Stack.Screen name="forgot-password" options={{ headerShown: false }} />
    <Stack.Screen name="reset-password" options={{ headerShown: false }} />
    <Stack.Screen name="settings/index" options={{ title: "Settings" }} />
    <Stack.Screen name="settings/app-lock" options={{ title: "App lock" }} />
    <Stack.Screen name="settings/delete-account" options={{ title: "Delete account" }} />
  </Stack><MobileNavigation /></View>;
}
