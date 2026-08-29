import { useEffect, useState } from "react";
import { useLocalSearchParams, useNavigation, router } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { Switch, Text, View } from "react-native";
import { api } from "@/src/lib/api";
import type { Identity } from "@/src/lib/models";
import { Action, ErrorText, Field, Loading, Notice, Screen, Subtitle, Title, styles } from "@/src/components/ui";
import { useTheme } from "@/src/lib/theme";

export default function EditIdentityScreen() {
  const navigation = useNavigation();
  const { colors } = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();

  const identities = useQuery({ queryKey: ["identities"], queryFn: () => api<Identity[]>("/identities") });
  const identity = identities.data?.find((row) => row.id === id);

  const [displayName, setDisplayName] = useState("");
  const [bio, setBio] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [location, setLocation] = useState("");
  const [pronouns, setPronouns] = useState("");
  const [birthDate, setBirthDate] = useState("");
  const [showBirthDate, setShowBirthDate] = useState(false);
  const [gender, setGender] = useState("");
  const [showGender, setShowGender] = useState(false);
  const [visible, setVisible] = useState(true);
  const [newUsername, setNewUsername] = useState("");
  const [saving, setSaving] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const [error, setError] = useState<string>();
  const [saved, setSaved] = useState(false);
  const [renamed, setRenamed] = useState(false);

  useEffect(() => {
    if (!identity) return;
    setDisplayName(identity.displayName);
    setBio(identity.bio);
    setAvatarUrl(identity.avatarUrl ?? "");
    setLocation(identity.location ?? "");
    setPronouns(identity.pronouns ?? "");
    setBirthDate(identity.birthDate ? identity.birthDate.slice(0, 10) : "");
    setShowBirthDate(identity.showBirthDate);
    setGender(identity.gender ?? "");
    setShowGender(identity.showGender);
    setVisible(identity.isVisible);
    setNewUsername(identity.username);
  }, [identity]);

  useEffect(() => {
    if (identity) navigation.setOptions({ title: identity.isPrimary ? "Your Keeper profile" : identity.displayName });
  }, [navigation, identity]);

  if (identities.isLoading) return <Loading label="Loading…" />;
  if (!identity) return <Screen><ErrorText>That byline couldn't be found.</ErrorText></Screen>;

  const save = async () => {
    setSaving(true);
    setError(undefined);
    setSaved(false);
    try {
      await api(`/identities/${identity.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          displayName,
          bio,
          avatarUrl: avatarUrl || null,
          location: location || null,
          pronouns: pronouns || null,
          birthDate: birthDate || null,
          showBirthDate,
          gender: gender || null,
          showGender,
          isVisible: identity.isPrimary ? undefined : visible,
        }),
      });
      await identities.refetch();
      setSaved(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save changes.");
    } finally {
      setSaving(false);
    }
  };

  const renameUsername = async () => {
    setRenaming(true);
    setError(undefined);
    setRenamed(false);
    try {
      await api("/identities/me/username", { method: "POST", body: JSON.stringify({ username: newUsername }) });
      await identities.refetch();
      setRenamed(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not change your username.");
    } finally {
      setRenaming(false);
    }
  };

  return (
    <Screen>
      <Title>{identity.isPrimary ? "Your Keeper profile" : identity.displayName}</Title>
      <Subtitle>
        @{identity.username} · {identity.isPrimary ? "This is your own profile - always visible and findable." : "Pen name"}
      </Subtitle>

      {identity.isPrimary && identity.canChangeUsername && (
        <View style={[styles.card, { borderColor: colors.border, backgroundColor: colors.surface }]}>
          <Text style={{ color: colors.ink, fontWeight: "700" }}>Your username was generated for you</Text>
          <Subtitle>You can change it once. After that, it's permanent.</Subtitle>
          <Field autoCapitalize="none" value={newUsername} onChangeText={(v) => setNewUsername(v.toLowerCase())} />
          <Action title={renaming ? "Saving…" : "Save username"} tone="secondary" disabled={renaming} onPress={() => void renameUsername()} />
          {renamed && <Notice>Saved. This is permanent now.</Notice>}
        </View>
      )}

      <Field placeholder="Display name" value={displayName} onChangeText={setDisplayName} />
      <Field multiline placeholder="Bio" value={bio} onChangeText={setBio} style={{ minHeight: 90, textAlignVertical: "top" }} />
      <Field placeholder="Avatar URL (optional)" value={avatarUrl} onChangeText={setAvatarUrl} />
      <Field placeholder="Location (optional)" value={location} onChangeText={setLocation} />
      <Field placeholder="Pronouns (optional)" value={pronouns} onChangeText={setPronouns} />

      <Text style={{ color: colors.ink, fontWeight: "700" }}>Personal details</Text>
      <Subtitle>Both are optional and stay off your profile until you turn them on here.</Subtitle>
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

      {!identity.isPrimary && (
        <View style={styles.row}>
          <Switch value={visible} onValueChange={setVisible} trackColor={{ true: colors.brand }} accessibilityLabel="Visible to readers" />
          <Text style={{ color: colors.ink }}>Visible to readers</Text>
        </View>
      )}

      {error && <ErrorText>{error}</ErrorText>}
      {saved && <Notice>Saved.</Notice>}

      <View style={styles.row}>
        <Action title={saving ? "Saving…" : "Save"} disabled={saving} onPress={() => void save()} />
        <Action title="Done" tone="secondary" onPress={() => router.back()} />
      </View>
    </Screen>
  );
}
