import { useEffect, useState } from "react";
import { Switch, Text, View } from "react-native";
import { Action, Card, ErrorText, Eyebrow, Field, Notice, Screen, Subtitle, Title } from "@/src/components/ui";
import { useTheme } from "@/src/lib/theme";
import {
  biometricLabel,
  clearAppLock,
  hasPinSet,
  isBiometricAvailable,
  isBiometricEnabled,
  setBiometricEnabled,
  setPin,
  verifyPin,
} from "@/src/lib/app-lock";

export default function AppLockSettingsScreen() {
  const { colors } = useTheme();
  const [loading, setLoading] = useState(true);
  const [pinSet, setPinSet] = useState(false);
  const [biometricSupported, setBiometricSupported] = useState(false);
  const [biometricOn, setBiometricOn] = useState(false);
  const [biometricName, setBiometricName] = useState("Fingerprint");

  const [newPin, setNewPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const [currentPinForDisable, setCurrentPinForDisable] = useState("");
  const [confirmingDisable, setConfirmingDisable] = useState(false);
  const [error, setError] = useState<string>();
  const [notice, setNotice] = useState<string>();
  const [busy, setBusy] = useState(false);

  const refresh = async () => {
    const [pinIsSet, supported, enabled, label] = await Promise.all([hasPinSet(), isBiometricAvailable(), isBiometricEnabled(), biometricLabel()]);
    setPinSet(pinIsSet); setBiometricSupported(supported); setBiometricOn(enabled); setBiometricName(label);
    setLoading(false);
  };
  useEffect(() => { void refresh(); }, []);

  const createPin = async () => {
    setError(undefined);
    if (newPin.length < 4) { setError("Choose a PIN with at least 4 digits."); return; }
    if (newPin !== confirmPin) { setError("Those two PINs don't match."); return; }
    setBusy(true);
    try {
      await setPin(newPin);
      setNewPin(""); setConfirmPin(""); setNotice("App lock is on. NotesChain will ask for this PIN when you reopen it.");
      await refresh();
    } finally { setBusy(false); }
  };

  const toggleBiometric = async (next: boolean) => {
    setError(undefined);
    await setBiometricEnabled(next);
    setBiometricOn(next);
  };

  const confirmDisable = async () => {
    setError(undefined); setBusy(true);
    try {
      const ok = await verifyPin(currentPinForDisable);
      if (!ok) { setError("Incorrect PIN."); return; }
      await clearAppLock();
      setCurrentPinForDisable(""); setConfirmingDisable(false); setNotice("App lock is off.");
      await refresh();
    } finally { setBusy(false); }
  };

  if (loading) return <Screen><Title>App lock</Title><Subtitle>Loading…</Subtitle></Screen>;

  return <Screen>
    <View style={{ gap: 6, paddingTop: 4 }}><Eyebrow>Security</Eyebrow><Title>App lock</Title><Subtitle>Require a PIN or fingerprint before NotesChain opens on this device — on top of, not instead of, your account sign-in.</Subtitle></View>
    {notice ? <Notice>{notice}</Notice> : null}

    {pinSet ? <>
      <Notice>App lock is on.</Notice>
      {biometricSupported ? <Card style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
        <View style={{ flex: 1, gap: 3 }}>
          <Text style={{ color: colors.ink, fontWeight: "700", fontSize: 16 }}>{biometricName}</Text>
          <Text style={{ color: colors.muted, fontSize: 14 }}>Use {biometricName.toLowerCase()} instead of typing your PIN.</Text>
        </View>
        <Switch value={biometricOn} onValueChange={(v) => void toggleBiometric(v)} trackColor={{ true: colors.brand }} accessibilityLabel={`Use ${biometricName.toLowerCase()} to unlock`} />
      </Card> : null}

      {!confirmingDisable ? <Action title="Turn off app lock" tone="danger" onPress={() => { setConfirmingDisable(true); setError(undefined); }} /> : <View style={{ gap: 10 }}>
        <Text style={{ color: colors.ink }}>Enter your current PIN to turn off app lock.</Text>
        <Field value={currentPinForDisable} onChangeText={setCurrentPinForDisable} keyboardType="number-pad" secureTextEntry maxLength={6} placeholder="Current PIN" />
        {error ? <ErrorText>{error}</ErrorText> : null}
        <View style={{ flexDirection: "row", gap: 10 }}>
          <View style={{ flex: 1 }}><Action title="Cancel" tone="secondary" onPress={() => { setConfirmingDisable(false); setCurrentPinForDisable(""); setError(undefined); }} /></View>
          <View style={{ flex: 1 }}><Action title={busy ? "Checking…" : "Turn off"} tone="danger" disabled={busy || currentPinForDisable.length < 4} onPress={() => void confirmDisable()} /></View>
        </View>
      </View>}
    </> : <>
      <Text style={{ color: colors.ink, fontWeight: "700" }}>Choose a PIN (4–6 digits)</Text>
      <Field value={newPin} onChangeText={(v) => setNewPin(v.replace(/[^0-9]/g, "").slice(0, 6))} keyboardType="number-pad" secureTextEntry maxLength={6} placeholder="New PIN" />
      <Field value={confirmPin} onChangeText={(v) => setConfirmPin(v.replace(/[^0-9]/g, "").slice(0, 6))} keyboardType="number-pad" secureTextEntry maxLength={6} placeholder="Confirm PIN" />
      {error ? <ErrorText>{error}</ErrorText> : null}
      <Action title={busy ? "Saving…" : "Set PIN"} disabled={busy || newPin.length < 4 || confirmPin.length < 4} onPress={() => void createPin()} />
    </>}
  </Screen>;
}
