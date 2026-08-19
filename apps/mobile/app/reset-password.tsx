import { useState } from "react";
import { useLocalSearchParams, router } from "expo-router";
import { api } from "@/src/lib/api";
import { Action, ErrorText, Field, Notice, Screen, Subtitle, Title } from "@/src/components/ui";

export default function ResetPasswordScreen() {
  const { token } = useLocalSearchParams<{ token?: string }>(); const [password, setPassword] = useState(""); const [status, setStatus] = useState<string>(); const [error, setError] = useState<string>();
  const reset = async () => { if (!token) return; try { await api("/auth/reset-password", { method: "POST", body: JSON.stringify({ token, password }) }); setStatus("Password updated. You can now sign in."); setTimeout(() => router.replace("/account"), 1200); } catch (e) { setError(e instanceof Error ? e.message : "Could not reset password."); } };
  return <Screen><Title>Choose a new password</Title><Subtitle>Your reset link is single-use.</Subtitle>{!token ? <ErrorText>This reset link is incomplete or has expired.</ErrorText> : <><Field secureTextEntry placeholder="New password (at least 10 characters)" value={password} onChangeText={setPassword} />{status && <Notice>{status}</Notice>}{error && <ErrorText>{error}</ErrorText>}<Action title="Set new password" disabled={password.length < 10} onPress={() => void reset()} /></>}</Screen>;
}
