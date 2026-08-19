import { useEffect, useState } from "react";
import { Link, router } from "expo-router";
import { View } from "react-native";
import { api, setToken } from "@/src/lib/api";
import { Action, ErrorText, Field, Loading, Screen, Subtitle, Title, styles } from "@/src/components/ui";

export default function AccountScreen() {
  const [email, setEmail] = useState(""); const [password, setPassword] = useState(""); const [error, setError] = useState<string>(); const [user, setUser] = useState<{ email: string } | null>(); const [busy, setBusy] = useState(false);
  useEffect(() => { api<{ user: { email: string } }>("/auth/me").then((result) => setUser(result.user)).catch(() => setUser(null)); }, []);
  const login = async () => {
    setBusy(true); setError(undefined);
    try { const result = await api<{ session: { token: string } }>("/auth/mobile/login", { method: "POST", body: JSON.stringify({ email, password, deviceName: "NotesChain mobile" }) }); await setToken(result.session.token); router.replace("/drafts"); }
    catch (err) { setError(err instanceof Error ? err.message : "Could not sign in."); }
    finally { setBusy(false); }
  };
  if (user === undefined) return <Loading label="Checking your session…" />;
  if (user) return <Screen><Title>Your account</Title><Subtitle>{user.email}</Subtitle><View style={styles.card}><Link href="/drafts">Drafts and publishing</Link><Link href="/analytics">Published-note analytics</Link><Link href="/identities">Public identities</Link><Link href="/bookmarks">Bookmarks</Link></View><Action title="Sign out" tone="secondary" onPress={async () => { try { await api("/auth/mobile/logout", { method: "POST" }); } finally { await setToken(null); router.replace("/"); } }} /></Screen>;
  return <Screen><Title>Sign in</Title><Subtitle>Use your NotesChain account to write, save and publish.</Subtitle><Field autoCapitalize="none" autoComplete="email" keyboardType="email-address" placeholder="Email" value={email} onChangeText={setEmail} /><Field secureTextEntry autoComplete="password" placeholder="Password" value={password} onChangeText={setPassword} /><Action title={busy ? "Signing in…" : "Sign in"} disabled={busy || !email || !password} onPress={login} />{error && <ErrorText>{error}</ErrorText>}<Link href="/register">Create an account</Link><Link href="/forgot-password">Forgot password?</Link></Screen>;
}
