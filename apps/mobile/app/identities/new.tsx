import { useState } from "react";
import { router } from "expo-router";
import { Switch, Text, View } from "react-native";
import { api } from "@/src/lib/api";
import { Action, ErrorText, Field, Screen, Subtitle, Title, styles } from "@/src/components/ui";

export default function NewIdentityScreen() {
  const [type, setType] = useState<"REAL_NAME" | "PSEUDONYM">("PSEUDONYM"); const [username, setUsername] = useState(""); const [displayName, setDisplayName] = useState(""); const [bio, setBio] = useState(""); const [visible, setVisible] = useState(true); const [error, setError] = useState<string>(); const [busy, setBusy] = useState(false);
  const save = async () => { setBusy(true); setError(undefined); try { await api("/identities", { method: "POST", body: JSON.stringify({ type, username, displayName, bio, isVisible: visible }) }); router.back(); } catch (e) { setError(e instanceof Error ? e.message : "Could not create identity."); } finally { setBusy(false); } };
  return <Screen><Title>New identity</Title><Subtitle>Use a pseudonym if you do not want your real name on published notes.</Subtitle><View style={styles.row}><Action title="Pseudonym" tone={type === "PSEUDONYM" ? "primary" : "secondary"} onPress={() => setType("PSEUDONYM")} /><Action title="Real name" tone={type === "REAL_NAME" ? "primary" : "secondary"} onPress={() => setType("REAL_NAME")} /></View><Field autoCapitalize="none" placeholder="username" value={username} onChangeText={(v) => setUsername(v.toLowerCase())} /><Field placeholder="Display name" value={displayName} onChangeText={setDisplayName} /><Field multiline placeholder="Short bio (optional)" value={bio} onChangeText={setBio} style={[styles.field, { minHeight: 100, textAlignVertical: "top" }]} /><View style={styles.row}><Switch value={visible} onValueChange={setVisible} /><Text>Show this identity publicly</Text></View>{error && <ErrorText>{error}</ErrorText>}<Action title={busy ? "Creating…" : "Create identity"} disabled={busy || !username || !displayName} onPress={save} /></Screen>;
}
