import { useState } from "react";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { api } from "@/src/lib/api";
import { Action, ErrorText, Field, IconButton, Notice, Screen, Subtitle, Title } from "@/src/components/ui";
import { useTheme } from "@/src/lib/theme";

export default function ForgotPasswordScreen() {
  const { colors } = useTheme();
  const [email, setEmail] = useState(""); const [status, setStatus] = useState<string>(); const [error, setError] = useState<string>();
  const send = async () => { try { await api("/auth/forgot-password", { method: "POST", body: JSON.stringify({ email }) }); setStatus("If that email has an account, a reset link is on its way."); } catch (e) { setError(e instanceof Error ? e.message : "Could not send reset link."); } };
  return <Screen insetTop><IconButton tone="plain" icon={<Ionicons name="arrow-back" size={24} color={colors.brand} />} accessibilityLabel="Go back" onPress={() => router.canGoBack() ? router.back() : router.replace("/account")} /><Title>Reset password</Title><Subtitle>We’ll send a secure reset link to your email address.</Subtitle><Field accessibilityLabel="Email address" autoCapitalize="none" autoComplete="email" keyboardType="email-address" placeholder="Email" value={email} onChangeText={setEmail} />{status && <Notice>{status}</Notice>}{error && <ErrorText>{error}</ErrorText>}<Action title="Send reset link" disabled={!email} onPress={() => void send()} /></Screen>;
}
