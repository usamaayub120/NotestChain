import { useState } from "react";
import { router } from "expo-router";
import { Modal, Text, View } from "react-native";
import { api, setToken } from "@/src/lib/api";
import { Action, ErrorText, Field, Screen, Subtitle, Title } from "@/src/components/ui";
import { useTheme } from "@/src/lib/theme";

const idempotencyKey = () => `delete-account-${Date.now()}-${Math.random().toString(16).slice(2)}`;

export default function DeleteAccountScreen() {
  const { colors } = useTheme();
  const [password, setPassword] = useState("");
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();

  const confirmDelete = async () => {
    setBusy(true);
    setError(undefined);
    try {
      await api("/auth/account", { method: "DELETE", body: JSON.stringify({ password }), idempotencyKey: idempotencyKey() });
      await setToken(null);
      router.replace("/");
    } catch (e) {
      setConfirming(false);
      setError(e instanceof Error ? e.message : "Could not delete your account.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen>
      <Title>Delete your account</Title>
      <Subtitle>
        This closes your account for good — every session ends, your password stops working, and unfinished
        drafts are deleted with it. Notes you've already published stay published; that's the one thing account
        deletion can't undo.
      </Subtitle>
      <Field secureTextEntry placeholder="Confirm your password" value={password} onChangeText={setPassword} />
      {error && !confirming && <ErrorText>{error}</ErrorText>}
      <Action
        title="Delete account"
        tone="danger"
        disabled={!password}
        onPress={() => {
          setError(undefined);
          setConfirming(true);
        }}
      />

      <Modal visible={confirming} transparent animationType="fade" onRequestClose={() => !busy && setConfirming(false)}>
        <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.55)", justifyContent: "center", padding: 24 }}>
          <View style={{ backgroundColor: colors.surface, borderRadius: 16, padding: 20, gap: 14, borderWidth: 1, borderColor: colors.border }}>
            <Text accessibilityRole="header" style={{ color: colors.ink, fontSize: 20, fontWeight: "700" }}>
              Delete your account?
            </Text>
            <Text style={{ color: colors.muted, fontSize: 15, lineHeight: 21 }}>
              Ends every session and disables sign-in immediately. This can't be undone.
            </Text>
            {error ? <ErrorText>{error}</ErrorText> : null}
            <View style={{ flexDirection: "row", gap: 10, justifyContent: "flex-end" }}>
              <Action title="Cancel" tone="secondary" disabled={busy} onPress={() => setConfirming(false)} />
              <Action title={busy ? "Deleting…" : "Delete account"} tone="danger" disabled={busy} onPress={() => void confirmDelete()} />
            </View>
          </View>
        </View>
      </Modal>
    </Screen>
  );
}
