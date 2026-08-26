import { useState } from "react";
import { router } from "expo-router";
import { Switch, Text, View } from "react-native";
import { api } from "@/src/lib/api";
import { Action, ErrorText, Field, Screen, Subtitle, Title, styles } from "@/src/components/ui";
import { useTheme } from "@/src/lib/theme";

// Every identity created here IS a pen name — the API ignores any `type`
// sent on this route regardless (identities.service.ts on the API): a
// REAL_NAME byline only ever exists as the Keeper profile made at
// registration, so there is no type picker here anymore.
export default function NewIdentityScreen() {
  const { colors } = useTheme();
  const [username, setUsername] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [bio, setBio] = useState("");
  const [location, setLocation] = useState("");
  const [pronouns, setPronouns] = useState("");
  const [birthDate, setBirthDate] = useState("");
  const [showBirthDate, setShowBirthDate] = useState(false);
  const [gender, setGender] = useState("");
  const [showGender, setShowGender] = useState(false);
  const [visible, setVisible] = useState(true);
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);

  const save = async () => {
    setBusy(true);
    setError(undefined);
    try {
      await api("/identities", {
        method: "POST",
        body: JSON.stringify({
          username,
          displayName,
          bio,
          location: location || undefined,
          pronouns: pronouns || undefined,
          birthDate: birthDate || undefined,
          showBirthDate,
          gender: gender || undefined,
          showGender,
          isVisible: visible,
        }),
      });
      router.back();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not create pen name.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen>
      <Title>New pen name</Title>
      <Subtitle>Readers never see that this belongs to the same account as any of your other bylines.</Subtitle>
      <Field autoCapitalize="none" placeholder="username" value={username} onChangeText={(v) => setUsername(v.toLowerCase())} />
      <Field placeholder="Display name" value={displayName} onChangeText={setDisplayName} />
      <Field multiline placeholder="Short bio (optional)" value={bio} onChangeText={setBio} style={{ minHeight: 100, textAlignVertical: "top" }} />
      <Field placeholder="Location (optional)" value={location} onChangeText={setLocation} />
      <Field placeholder="Pronouns (optional)" value={pronouns} onChangeText={setPronouns} />

      <Text style={{ color: colors.ink, fontWeight: "700" }}>Personal details</Text>
      <Subtitle>Both are optional and stay off this pen name's profile until you turn them on here.</Subtitle>
      <Field placeholder="Birth date (YYYY-MM-DD, optional)" keyboardType="numbers-and-punctuation" value={birthDate} onChangeText={setBirthDate} />
      <View style={styles.row}>
        <Switch value={showBirthDate} onValueChange={setShowBirthDate} trackColor={{ true: colors.brand }} accessibilityLabel="Show birth date on profile" />
        <Text style={{ color: colors.ink }}>Show birth date on profile</Text>
      </View>
      <Field placeholder="Gender (optional)" value={gender} onChangeText={setGender} />
      <View style={styles.row}>
        <Switch value={showGender} onValueChange={setShowGender} trackColor={{ true: colors.brand }} accessibilityLabel="Show gender on profile" />
        <Text style={{ color: colors.ink }}>Show gender on profile</Text>
      </View>

      <View style={styles.row}>
        <Switch value={visible} onValueChange={setVisible} trackColor={{ true: colors.brand }} accessibilityLabel="Show this pen name publicly" />
        <Text style={{ color: colors.ink }}>Show this pen name publicly</Text>
      </View>
      {error && <ErrorText>{error}</ErrorText>}
      <Action title={busy ? "Creating…" : "Create pen name"} disabled={busy || !username || !displayName} onPress={() => void save()} />
    </Screen>
  );
}
