import { useEffect, useState } from "react";
import { Link, router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { api, setToken } from "@/src/lib/api";
import { Action, ErrorText, Eyebrow, Field, Loading, Screen, Subtitle, Title, colors, styles } from "@/src/components/ui";

function AccountLink({ href, title, detail, icon }: { href: "/drafts" | "/analytics" | "/identities" | "/bookmarks"; title: string; detail: string; icon: React.ComponentProps<typeof Ionicons>["name"] }) {
  return <Link href={href} asChild><Pressable accessibilityRole="link" style={({ pressed }) => [styles.card, local.accountLink, pressed && local.pressed]}><View style={local.icon}><Ionicons name={icon} size={20} color={colors.brand} /></View><View style={{ flex: 1, gap: 2 }}><Text style={local.linkTitle}>{title}</Text><Text style={styles.subtitle}>{detail}</Text></View><Ionicons name="chevron-forward" size={18} color={colors.muted} /></Pressable></Link>;
}

export default function AccountScreen() {
  const [email, setEmail] = useState(""); const [password, setPassword] = useState(""); const [error, setError] = useState<string>(); const [user, setUser] = useState<{ email: string } | null>(); const [busy, setBusy] = useState(false);
  useEffect(() => { api<{ user: { email: string } }>("/auth/me").then((result) => setUser(result.user)).catch(() => setUser(null)); }, []);
  const login = async () => {
    setBusy(true); setError(undefined);
    try { const result = await api<{ session: { token: string } }>("/auth/mobile/login", { method: "POST", body: JSON.stringify({ email, password, deviceName: "NotesChain mobile" }) }); await setToken(result.session.token); router.push("/drafts"); }
    catch (err) { setError(err instanceof Error ? err.message : "Could not sign in."); }
    finally { setBusy(false); }
  };
  if (user === undefined) return <Loading label="Checking your secure session…" />;
  if (user) return <Screen><View style={{ gap: 6, paddingTop: 4 }}><Eyebrow>Your reading desk</Eyebrow><Title>Welcome back</Title><Subtitle>{user.email}</Subtitle></View><AccountLink href="/drafts" title="Drafts & publishing" detail="Keep writing, then publish when ready." icon="create-outline" /><AccountLink href="/analytics" title="Published notes" detail="See unique readers for your work." icon="stats-chart-outline" /><AccountLink href="/identities" title="Public identities" detail="Manage your named and pseudonymous bylines." icon="person-outline" /><AccountLink href="/bookmarks" title="Saved notes" detail="Return to thoughts you want to keep." icon="bookmark-outline" /><Action title="Sign out" tone="secondary" icon={<Ionicons name="log-out-outline" size={19} color={colors.ink} />} onPress={async () => { try { await api("/auth/mobile/logout", { method: "POST" }); } finally { await setToken(null); router.replace("/"); } }} /></Screen>;
  return <Screen><View style={{ gap: 7, paddingTop: 4 }}><Eyebrow>NotesChain account</Eyebrow><Title>Sign in to keep writing.</Title><Subtitle>Access your drafts, saved notes, and publishing tools on this device.</Subtitle></View><View style={local.form}><Text style={local.label}>Email address</Text><Field autoCapitalize="none" autoComplete="email" keyboardType="email-address" placeholder="you@example.com" value={email} onChangeText={setEmail} /><Text style={local.label}>Password</Text><Field secureTextEntry autoComplete="password" placeholder="Your password" value={password} onChangeText={setPassword} /></View>{error && <ErrorText>{error}</ErrorText>}<Action title={busy ? "Signing in…" : "Sign in"} disabled={busy || !email || !password} onPress={login} icon={<Ionicons name="arrow-forward" size={18} color="#fff" />} /><View style={local.links}><Link href="/register" style={local.textLink}>Create an account</Link><Link href="/forgot-password" style={local.textLink}>Forgot password?</Link></View></Screen>;
}

const local = StyleSheet.create({
  form: { gap: 8 }, label: { color: colors.ink, fontSize: 14, fontWeight: "800", marginTop: 2 }, links: { gap: 14, paddingTop: 4 }, textLink: { color: colors.brand, fontWeight: "800", fontSize: 15 },
  accountLink: { flexDirection: "row", alignItems: "center", gap: 12 }, icon: { width: 40, height: 40, borderRadius: 12, alignItems: "center", justifyContent: "center", backgroundColor: "#fce1d9" }, linkTitle: { color: colors.ink, fontSize: 16, fontWeight: "800" }, pressed: { opacity: 0.75 },
});
