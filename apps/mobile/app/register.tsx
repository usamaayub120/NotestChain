import { useState } from "react";
import { useLocalSearchParams, router } from "expo-router";
import { api, setToken } from "@/src/lib/api";
import { requestCaptcha } from "@/src/lib/captcha";
import { Action, ErrorText, Field, Notice, Screen, Subtitle, Title } from "@/src/components/ui";

export default function RegisterScreen() {
  const { captchaToken } = useLocalSearchParams<{ captchaToken?: string }>(); const [email, setEmail] = useState(""); const [password, setPassword] = useState(""); const [error, setError] = useState<string>(); const [busy, setBusy] = useState(false);
  const register = async () => { if (!captchaToken) { await requestCaptcha("register"); return; } setBusy(true); setError(undefined); try { const result = await api<{ session: { token: string } }>("/auth/mobile/register", { method: "POST", body: JSON.stringify({ email, password, captchaToken, deviceName: "NotesChain mobile" }) }); await setToken(result.session.token); router.replace("/drafts"); } catch (e) { setError(e instanceof Error ? e.message : "Could not create account."); } finally { setBusy(false); } };
  return <Screen><Title>Create your account</Title><Subtitle>Your session is stored only in this device’s secure storage.</Subtitle><Field autoCapitalize="none" keyboardType="email-address" placeholder="Email" value={email} onChangeText={setEmail} /><Field secureTextEntry placeholder="Password (at least 10 characters)" value={password} onChangeText={setPassword} />{!captchaToken && <Notice>Before creating the account, complete a quick first-party verification in your browser. You will return here automatically.</Notice>}{captchaToken && <Notice>Verification complete. You can create your account now.</Notice>}{error && <ErrorText>{error}</ErrorText>}<Action title={busy ? "Creating…" : captchaToken ? "Create account" : "Verify to continue"} disabled={busy || !email || password.length < 10} onPress={() => void register()} /></Screen>;
}
