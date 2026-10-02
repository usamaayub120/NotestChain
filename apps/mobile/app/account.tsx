import { useCallback, useEffect, useState, type PropsWithChildren } from "react";
import { Link, router, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { api, MobileApiError, setToken } from "@/src/lib/api";
import { syncPushRegistration, unregisterPushToken } from "@/src/lib/push";
import { Action, ErrorText, Eyebrow, Field, Loading, Notice, Screen, Subtitle, Title } from "@/src/components/ui";
import { useTheme } from "@/src/lib/theme";

function AccountSection({ title, children }: PropsWithChildren<{ title: string }>) {
  const { colors } = useTheme();
  return <View style={local.section}><Text style={[local.sectionTitle, { color: colors.muted }]}>{title}</Text><View style={[local.group, { borderColor: colors.border, backgroundColor: colors.surface }]}>{children}</View></View>;
}

function AccountLink({ href, title, detail, icon, last = false }: { href: "/drafts" | "/analytics" | "/identities" | "/bookmarks" | "/settings" | "/verify"; title: string; detail: string; icon: React.ComponentProps<typeof Ionicons>["name"]; last?: boolean }) {
  const { colors } = useTheme();
  return <Pressable accessibilityRole="link" accessibilityLabel={title} accessibilityHint={detail} onPress={() => router.push(href)} style={({ pressed }) => [local.accountLink, { borderBottomColor: colors.border, borderBottomWidth: last ? 0 : StyleSheet.hairlineWidth }, pressed && local.pressed]}><View style={[local.icon, { backgroundColor: colors.iconSoft }]}><Ionicons name={icon} size={19} color={colors.brand} /></View><View style={local.linkCopy}><Text style={[local.linkTitle, { color: colors.ink }]}>{title}</Text><Text style={[local.linkDetail, { color: colors.muted }]}>{detail}</Text></View><Ionicons name="chevron-forward" size={19} color={colors.muted} /></Pressable>;
}

export default function AccountScreen() {
  const { colors } = useTheme();
  // Set by the 401 handler in _layout.tsx when a bearer session expires
  // mid-session, so arriving here reads as a session ending rather than as
  // the app losing the reader's place.
  const { reason, returnNote } = useLocalSearchParams<{ reason?: string; returnNote?: string }>();
  const [email, setEmail] = useState(""); const [password, setPassword] = useState(""); const [error, setError] = useState<string>(); const [user, setUser] = useState<{ email: string } | null>(); const [sessionError, setSessionError] = useState<string>(); const [busy, setBusy] = useState(false);
  const loadSession = useCallback(async () => {
    setUser(undefined);
    setSessionError(undefined);
    try {
      const result = await api<{ user: { email: string } }>("/auth/me");
      setUser(result.user);
    } catch (e) {
      // A genuine unauthenticated response should show sign-in. A stalled
      // connection must not impersonate a signed-out state.
      if (e instanceof MobileApiError && e.status === 401) {
        await setToken(null);
        setUser(null);
      }
      else {
        setUser(null);
        setSessionError(e instanceof Error ? e.message : "We couldn't check your secure session.");
      }
    }
  }, []);
  useEffect(() => { void loadSession(); }, [loadSession]);
  const login = async () => {
    setBusy(true); setError(undefined);
    try { const result = await api<{ session: { token: string } }>("/auth/mobile/login", { method: "POST", body: JSON.stringify({ email, password, deviceName: "NotesChain mobile" }) }); await setToken(result.session.token); setUser({ email }); setPassword(""); void syncPushRegistration(); if (returnNote && /^[A-Za-z0-9-]{1,100}$/.test(returnNote)) router.replace({ pathname: "/note/[id]", params: { id: returnNote } }); }
    catch (err) { setError(err instanceof Error ? err.message : "Could not sign in."); }
    finally { setBusy(false); }
  };
  if (user === undefined) return <Loading label="Checking your secure session…" />;
  if (sessionError) return <Screen><View style={{ gap: 8, paddingTop: 4 }}><Eyebrow>NotesChain account</Eyebrow><Title>We couldn’t reach NotesChain</Title><Subtitle>Your account has not been signed out. Check your connection, then try again.</Subtitle></View><ErrorText>{sessionError}</ErrorText><Action title="Try again" onPress={() => void loadSession()} /></Screen>;
  if (user) return <Screen>
    <View style={local.hero}><Eyebrow>Your reading desk</Eyebrow><Title>Welcome back</Title><View style={[local.emailPill, { backgroundColor: colors.soft }]}><Ionicons name="mail-outline" size={15} color={colors.muted} /><Text numberOfLines={1} style={{ color: colors.muted, fontWeight: "700", flexShrink: 1 }}>{user.email}</Text></View></View>
    <AccountSection title="Writing"><AccountLink href="/drafts" title="Drafts & publishing" detail="Keep writing, then publish when ready." icon="create-outline" /><AccountLink href="/analytics" title="Published notes" detail="See unique readers for your work." icon="stats-chart-outline" last /></AccountSection>
    <AccountSection title="Your library"><AccountLink href="/identities" title="Your bylines" detail="Your primary profile and any pen names." icon="person-outline" /><AccountLink href="/bookmarks" title="Saved notes" detail="Return to notes you want to keep." icon="bookmark-outline" last /></AccountSection>
    <AccountSection title="Tools & preferences"><AccountLink href="/verify" title="Verify a note" detail="Check any note's URL, signature, or address against its public record." icon="shield-checkmark-outline" /><AccountLink href="/settings" title="Settings" detail="Appearance and app preferences." icon="settings-outline" last /></AccountSection>
    <Action title="Sign out" tone="secondary" icon={<Ionicons name="log-out-outline" size={19} color={colors.ink} />} onPress={async () => { try { await unregisterPushToken(); await api("/auth/mobile/logout", { method: "POST" }); } finally { await setToken(null); router.replace("/"); } }} />
  </Screen>;
  return <Screen><View style={{ gap: 7, paddingTop: 4 }}><Eyebrow>NotesChain account</Eyebrow><Title>Sign in to keep writing.</Title><Subtitle>Access your drafts, saved notes, and publishing tools on this device.</Subtitle></View>{reason === "expired" && <Notice>Your session expired, so we signed you out on this device. Anything you saved is still here.</Notice>}<View style={local.form}><Text style={[local.label, { color: colors.ink }]}>Email address</Text><Field accessibilityLabel="Email address" autoCapitalize="none" autoComplete="email" keyboardType="email-address" placeholder="you@example.com" value={email} onChangeText={setEmail} /><Text style={[local.label, { color: colors.ink }]}>Password</Text><Field accessibilityLabel="Password" secureTextEntry autoComplete="password" placeholder="Your password" value={password} onChangeText={setPassword} /></View>{error && <ErrorText>{error}</ErrorText>}<Action title={busy ? "Signing in…" : "Sign in"} disabled={busy || !email || !password} onPress={login} icon={<Ionicons name="log-in-outline" size={18} color={colors.onBrand} />} /><View style={local.links}><Link href="/register" style={[local.textLink, { color: colors.brand }]}>Create an account</Link><Link href="/forgot-password" style={[local.textLink, { color: colors.brand }]}>Forgot password?</Link></View></Screen>;
}

const local = StyleSheet.create({
  hero: { gap: 6, paddingTop: 4 }, emailPill: { alignSelf: "flex-start", maxWidth: "100%", paddingHorizontal: 10, paddingVertical: 7, borderRadius: 999, flexDirection: "row", alignItems: "center", gap: 7 },
  form: { gap: 8 }, label: { fontSize: 14, fontWeight: "700", marginTop: 2 }, links: { gap: 14, paddingTop: 4 }, textLink: { fontWeight: "700", fontSize: 15 },
  section: { gap: 7 }, sectionTitle: { fontSize: 12, fontWeight: "700", letterSpacing: 0.75, textTransform: "uppercase", paddingHorizontal: 2 }, group: { overflow: "hidden", borderWidth: 1, borderRadius: 16 }, accountLink: { minHeight: 78, flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 14, paddingVertical: 13 }, icon: { width: 40, height: 40, borderRadius: 12, alignItems: "center", justifyContent: "center" }, linkCopy: { flex: 1, minWidth: 0, gap: 3 }, linkTitle: { fontSize: 16, fontWeight: "700" }, linkDetail: { fontSize: 14, lineHeight: 19 }, pressed: { opacity: 0.76 },
});
