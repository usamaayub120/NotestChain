import { useState } from "react";
import { useLocalSearchParams, router } from "expo-router";
import * as Linking from "expo-linking";
import { Switch, Text, View } from "react-native";
import { api, setToken } from "@/src/lib/api";
import { requestCaptcha } from "@/src/lib/captcha";
import { Action, ErrorText, Field, Notice, Screen, Subtitle, Title } from "@/src/components/ui";
import { useTheme } from "@/src/lib/theme";
import { webOrigin } from "@/src/lib/config";

export default function RegisterScreen() {
  const { colors } = useTheme();
  const { captchaToken } = useLocalSearchParams<{ captchaToken?: string }>(); const [email, setEmail] = useState(""); const [password, setPassword] = useState(""); const [acceptedTerms, setAcceptedTerms] = useState(false); const [error, setError] = useState<string>(); const [busy, setBusy] = useState(false);
  const register = async () => { if (!captchaToken) { await requestCaptcha("register"); return; } setBusy(true); setError(undefined); try { const result = await api<{ session: { token: string } }>("/auth/mobile/register", { method: "POST", body: JSON.stringify({ email, password, captchaToken, acceptedTerms, deviceName: "NotesChain mobile" }) }); await setToken(result.session.token); router.replace("/account"); } catch (e) { setError(e instanceof Error ? e.message : "Could not create account."); } finally { setBusy(false); } };
  return <Screen><Title>Create your account</Title><Subtitle>Your session is stored only in this device’s secure storage.</Subtitle><Field autoCapitalize="none" keyboardType="email-address" placeholder="Email" value={email} onChangeText={setEmail} /><Field secureTextEntry placeholder="Password (at least 10 characters)" value={password} onChangeText={setPassword} /><View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}><Switch value={acceptedTerms} onValueChange={setAcceptedTerms} trackColor={{ true: colors.brand }} accessibilityLabel="I agree to the Terms of Service and Privacy Policy" /><Text style={{ color: colors.ink, flex: 1, flexWrap: "wrap" }}>I agree to the <Text style={{ color: colors.brand, fontWeight: "700" }} onPress={() => Linking.openURL(`${webOrigin}/terms`)}>Terms of Service</Text> and <Text style={{ color: colors.brand, fontWeight: "700" }} onPress={() => Linking.openURL(`${webOrigin}/privacy`)}>Privacy Policy</Text>.</Text></View>{!captchaToken && <Notice>Before creating the account, complete a quick first-party verification in your browser. You will return here automatically.</Notice>}{captchaToken && <Notice>Verification complete. You can create your account now.</Notice>}{error && <ErrorText>{error}</ErrorText>}<Action title={busy ? "Creating…" : captchaToken ? "Create account" : "Verify to continue"} disabled={busy || !email || password.length < 10 || !acceptedTerms} onPress={() => void register()} /></Screen>;
}
