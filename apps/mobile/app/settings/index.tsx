import { useEffect, useState } from "react";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import * as Linking from "expo-linking";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Action, Card, Divider, Eyebrow, Notice, Screen, Subtitle, Title, styles as uiStyles } from "@/src/components/ui";
import { fontScaleLabels, type FontScalePreset, type ThemeMode, useTheme } from "@/src/lib/theme";
import { appEnv, webOrigin } from "@/src/lib/config";
import { describePushDiagnostic, getPushDiagnostic, syncPushRegistration, type PushDiagnostic } from "@/src/lib/push";

const fontScaleOrder: FontScalePreset[] = ["small", "default", "large", "xlarge"];

const choices: Array<{ mode: ThemeMode; title: string; detail: string; icon: React.ComponentProps<typeof Ionicons>["name"] }> = [
  { mode: "system", title: "Use device setting", detail: "Match your phone’s light or dark appearance.", icon: "phone-portrait-outline" },
  { mode: "light", title: "Light", detail: "Keep NotesChain bright.", icon: "sunny-outline" },
  { mode: "dark", title: "Dark", detail: "Use a calmer, low-light appearance.", icon: "moon-outline" },
];

export default function SettingsScreen() {
  const { colors, mode, resolvedMode, setMode, fontScale, fontScalePreset, setFontScalePreset } = useTheme();
  return <Screen><View style={local.heading}><Eyebrow>Preferences</Eyebrow><Title>Settings</Title><Subtitle>Choose how NotesChain looks on this device.</Subtitle></View>{appEnv !== "production" && <Notice>{appEnv === "preview" ? "Preview build — connected to noteschain.org. Use a test account." : "Development build."}</Notice>}<View style={local.choiceList}>{choices.map((choice) => {
    const selected = choice.mode === mode;
    return <Pressable key={choice.mode} accessibilityRole="radio" accessibilityState={{ checked: selected }} onPress={() => setMode(choice.mode)} style={({ pressed }) => [pressed && { opacity: 0.76 }]}><Card style={[local.choice, selected && { borderColor: colors.brand }]}><View style={[local.icon, { backgroundColor: selected ? colors.iconSoft : colors.soft }]}><Ionicons name={choice.icon} size={20} color={selected ? colors.brand : colors.muted} /></View><View style={local.copy}><Text style={[local.choiceTitle, { color: colors.ink }]}>{choice.title}</Text><Text style={[local.choiceDetail, { color: colors.muted }]}>{choice.detail}</Text></View><View style={[local.radio, { borderColor: selected ? colors.brand : colors.border }]}>{selected ? <View style={[local.dot, { backgroundColor: colors.brand }]} /> : null}</View></Card></Pressable>;
  })}</View><View style={[local.preview, { backgroundColor: colors.elevated, borderColor: colors.border }]}><Ionicons name={resolvedMode === "dark" ? "moon" : "sunny"} size={17} color={colors.brand} /><Text style={{ color: colors.muted, flex: 1 }}>Currently using {resolvedMode} appearance.</Text></View>
    <Divider />
    <View style={local.heading}><Eyebrow>Accessibility</Eyebrow><Title>Text size</Title><Subtitle>Make reading and writing more comfortable, independent of your device's own text size.</Subtitle></View>
    <View style={uiStyles.row}>{fontScaleOrder.map((preset) => <View key={preset} style={{ flex: 1 }}><Action title={fontScaleLabels[preset]} tone={fontScalePreset === preset ? "primary" : "secondary"} accessibilityRole="radio" accessibilityState={{ checked: fontScalePreset === preset }} onPress={() => setFontScalePreset(preset)} /></View>)}</View>
    <View style={[local.preview, { backgroundColor: colors.elevated, borderColor: colors.border }]}><Text style={{ color: colors.ink, fontSize: 16 * fontScale, flexShrink: 1 }}>The quick brown fox jumps over the lazy dog.</Text></View>
    <Divider />
    <NotificationsRow />
    <Divider />
    <View style={local.heading}><Eyebrow>Security</Eyebrow><Title>App lock</Title><Subtitle>Require a PIN or fingerprint to open NotesChain on this device.</Subtitle></View>
    <Action title="Set up app lock" tone="secondary" icon={<Ionicons name="lock-closed-outline" size={18} color={colors.ink} />} onPress={() => router.push("/settings/app-lock")} />
    <Divider /><Action title="Replay the introduction" tone="secondary" icon={<Ionicons name="information-circle-outline" size={18} color={colors.ink} />} onPress={() => router.push("/onboarding")} />
    <Divider />
    <View style={local.heading}><Eyebrow>Legal</Eyebrow><Title>Your account</Title></View>
    <Action title="Privacy policy" tone="secondary" icon={<Ionicons name="document-text-outline" size={18} color={colors.ink} />} onPress={() => Linking.openURL(`${webOrigin}/privacy`)} />
    <Action title="Terms of service" tone="secondary" icon={<Ionicons name="document-text-outline" size={18} color={colors.ink} />} onPress={() => Linking.openURL(`${webOrigin}/terms`)} />
    <Action title="Delete account" tone="danger" icon={<Ionicons name="trash-outline" size={18} color="#fff" />} onPress={() => router.push("/settings/delete-account")} /></Screen>;
}

/**
 * What getPushDiagnostic() has to say, in the one place a reader (or we,
 * over their shoulder) can actually see it — registration itself happens
 * silently on cold start with nothing else visible anywhere.
 */
function NotificationsRow() {
  const { colors } = useTheme();
  const [diagnostic, setDiagnostic] = useState<PushDiagnostic | null>(null);
  const [checking, setChecking] = useState(false);

  useEffect(() => { void getPushDiagnostic().then(setDiagnostic); }, []);

  const retry = async () => {
    setChecking(true);
    try {
      await syncPushRegistration();
      setDiagnostic(await getPushDiagnostic());
    } finally {
      setChecking(false);
    }
  };

  const registered = diagnostic?.state === "registered";

  return (
    <View style={{ gap: 10 }}>
      <View style={local.heading}><Eyebrow>Alerts</Eyebrow><Title>Notifications</Title><Subtitle>Comments, moderation decisions, kept notes, and new followers.</Subtitle></View>
      <View style={[local.preview, { backgroundColor: colors.elevated, borderColor: colors.border }]}>
        <Ionicons name={registered ? "notifications" : "notifications-outline"} size={17} color={registered ? colors.brand : colors.muted} />
        <Text style={{ color: colors.muted, flex: 1 }}>{diagnostic ? describePushDiagnostic(diagnostic) : "Checking…"}</Text>
      </View>
      {!registered && (
        <Action
          title={checking ? "Checking…" : "Try again"}
          tone="secondary"
          disabled={checking}
          icon={<Ionicons name="refresh-outline" size={18} color={colors.ink} />}
          onPress={() => void retry()}
        />
      )}
    </View>
  );
}

const local = StyleSheet.create({
  heading: { gap: 6, paddingTop: 4 }, choiceList: { gap: 10 }, choice: { minHeight: 84, flexDirection: "row", alignItems: "center", gap: 12 },
  icon: { width: 42, height: 42, borderRadius: 12, alignItems: "center", justifyContent: "center" }, copy: { flex: 1, minWidth: 0, gap: 3 }, choiceTitle: { fontSize: 16, fontWeight: "700" }, choiceDetail: { fontSize: 14, lineHeight: 19 },
  radio: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, alignItems: "center", justifyContent: "center" }, dot: { width: 10, height: 10, borderRadius: 5 }, preview: { borderWidth: 1, borderRadius: 12, padding: 13, flexDirection: "row", alignItems: "center", gap: 9 },
});
