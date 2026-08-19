import { useState } from "react";
import { api } from "@/src/lib/api";
import { Action, ErrorText, Field, Notice, Screen, Subtitle, Title } from "@/src/components/ui";

export default function ForgotPasswordScreen() {
  const [email, setEmail] = useState(""); const [status, setStatus] = useState<string>(); const [error, setError] = useState<string>();
  const send = async () => { try { await api("/auth/forgot-password", { method: "POST", body: JSON.stringify({ email }) }); setStatus("If that email has an account, a reset link is on its way."); } catch (e) { setError(e instanceof Error ? e.message : "Could not send reset link."); } };
  return <Screen><Title>Reset password</Title><Subtitle>We’ll send a secure reset link to your email address.</Subtitle><Field autoCapitalize="none" keyboardType="email-address" placeholder="Email" value={email} onChangeText={setEmail} />{status && <Notice>{status}</Notice>}{error && <ErrorText>{error}</ErrorText>}<Action title="Send reset link" disabled={!email} onPress={() => void send()} /></Screen>;
}
