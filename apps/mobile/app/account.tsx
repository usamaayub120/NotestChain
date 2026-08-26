import { useEffect, useState } from "react";
import { Link, router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { api, setToken } from "@/src/lib/api";
import { syncPushRegistration, unregisterPushToken } from "@/src/lib/push";
import { Action, Card, ErrorText, Eyebrow, Field, Loading, Screen, Subtitle, Title } from "@/src/components/ui";
import { useTheme } from "@/src/lib/theme";

function AccountLink({ href, title, detail, icon }: { href: "/drafts" | "/analytics" | "/identities" | "/bookmarks" | "/settings" | "/verify"; title: string; detail: string; icon: React.ComponentProps<typeof Ionicons>["name"] }) {
  const { colors } = useTheme();
  return <Link href={href} asChild><Pressable accessibilityRole="link" style={({ pressed }) => [local.accountLink, pressed && local.pressed]}><Card style={local.accountCard}><View style={[local.icon, { backgroundColor: colors.iconSoft }]}><Ionicons name={icon} size={20} color={colors.brand} /></View><View style={local.linkCopy}><Text style={[local.linkTitle, { color: colors.ink }]}>{title}</Text><Text style={[local.linkDetail, { color: colors.muted }]}>{detail}</Text></View><View style={local.chevron}><Ionicons name="chevron-forward" size={20} color={colors.muted} /></View></Card></Pressable></Link>;
}

export default function AccountScreen() {
  const { colors } = useTheme();
  const [email, setEmail] = useState(""); const [password, setPassword] = useState(""); const [error, setError] = useState<string>(); const [user, setUser] = useState<{ email: string } | null>(); const [busy, setBusy] = useState(false);
  useEffect(() => { api<{ user: { email: string } }>("/auth/me").then((result) => setUser(result.user)).catch(() => setUser(null)); }, []);
  const login = async () => {
    setBusy(true); setError(undefined);
    try { const result = await api<{ session: { token: string } }>("/auth/mobile/login", { method: "POST", body: JSON.stringify({ email, password, deviceName: "NotesChain mobile" }) }); await setToken(result.session.token); setUser({ email }); setPassword(""); void syncPushRegistration(); }
    catch (err) { setError(err instanceof Error ? err.message : "Could not sign in."); }
    finally { setBusy(false); }
  };
  if (user === undefined) return <Loading label="Checking your secure session…" />;
  if (user) return <Screen><View style={local.hero}><Eyebrow>Your reading desk</Eyebrow><Title>Welcome back</Title><View style={[local.emailPill, { backgroundColor: colors.soft }]}><Ionicons name="mail-outline" size={15} color={colors.muted} /><Text numberOfLines={1} style={{ color: colors.muted, fontWeight: "700", flexShrink: 1 }}>{user.email}</Text></View></View><View style={local.accountList}><AccountLink href="/drafts" title="Drafts & publishing" detail="Keep writing, then publish when ready." icon="create-outline" /><AccountLink href="/analytics" title="Published notes" detail="See unique readers for your work." icon="stats-chart-outline" /><AccountLink href="/identities" title="Your bylines" detail="Your Keeper profile and any pen names." icon="person-outline" /><AccountLink href="/bookmarks" title="Saved notes" detail="Return to thoughts you want to keep." icon="bookmark-outline" /></View><AccountLink href="/verify" title="Verify a note" detail="Check any note's URL, signature, or address against the chain." icon="shield-checkmark-outline" /><AccountLink href="/settings" title="Settings" detail="Appearance and app preferences." icon="settings-outline" /><Action title="Sign out" tone="secondary" icon={<Ionicons name="log-out-outline" size={19} color={colors.ink} />} onPress={async () => { try { await unregisterPushToken(); await api("/auth/mobile/logout", { method: "POST" }); } finally { await setToken(null); router.replace("/"); } }} /></Screen>;
  return <Screen><View style={{ gap: 7, paddingTop: 4 }}><Eyebrow>NotesChain account</Eyebrow><Title>Sign in to keep writing.</Title><Subtitle>Access your drafts, saved notes, and publishing tools on this device.</Subtitle></View><View style={local.form}><Text style={[local.label, { color: colors.ink }]}>Email address</Text><Field autoCapitalize="none" autoComplete="email" keyboardType="email-address" placeholder="you@example.com" value={email} onChangeText={setEmail} /><Text style={[local.label, { color: colors.ink }]}>Password</Text><Field secureTextEntry autoComplete="password" placeholder="Your password" value={password} onChangeText={setPassword} /></View>{error && <ErrorText>{error}</ErrorText>}<Action title={busy ? "Signing in…" : "Sign in"} disabled={busy || !email || !password} onPress={login} icon={<Ionicons name="log-in-outline" size={18} color="#fff" />} /><View style={local.links}><Link href="/register" style={[local.textLink, { color: colors.brand }]}>Create an account</Link><Link href="/forgot-password" style={[local.textLink, { color: colors.brand }]}>Forgot password?</Link></View></Screen>;
}

const local = StyleSheet.create({
  hero: { gap: 6, paddingTop: 4 }, emailPill: { alignSelf: "flex-start", maxWidth: "100%", paddingHorizontal: 10, paddingVertical: 7, borderRadius: 999, flexDirection: "row", alignItems: "center", gap: 7 },
  form: { gap: 8 }, label: { fontSize: 14, fontWeight: "700", marginTop: 2 }, links: { gap: 14, paddingTop: 4 }, textLink: { fontWeight: "700", fontSize: 15 },
  accountList: { gap: 10 }, accountLink: { width: "100%" }, accountCard: { minHeight: 82, flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 14 }, icon: { width: 42, height: 42, borderRadius: 12, alignItems: "center", justifyContent: "center" }, linkCopy: { flex: 1, minWidth: 0, gap: 3 }, linkTitle: { fontSize: 16, fontWeight: "700" }, linkDetail: { fontSize: 14, lineHeight: 19 }, chevron: { width: 24, alignSelf: "stretch", alignItems: "flex-end", justifyContent: "center" }, pressed: { opacity: 0.75 },
});
