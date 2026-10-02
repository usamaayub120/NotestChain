import { useEffect, useState } from "react";
import { Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Action, ErrorText, Field } from "@/src/components/ui";
import { useTheme } from "@/src/lib/theme";
import { authenticateWithBiometrics, biometricLabel, isBiometricEnabled, verifyPin } from "@/src/lib/app-lock";
import { fonts } from "@/src/lib/fonts";

/** Full-screen replacement for the whole app while a PIN is set and not yet unlocked this session. */
export function AppLockGate({ onUnlock }: { onUnlock: () => void }) {
  const { colors, fontScale } = useTheme();
  // This replaces the entire navigator, so there is no stack header to clear
  // the status bar or a punch-hole camera for it.
  const insets = useSafeAreaInsets();
  const [pin, setPin] = useState("");
  const [error, setError] = useState<string>();
  const [checking, setChecking] = useState(false);
  const [biometricReady, setBiometricReady] = useState(false);
  const [biometricLabelText, setBiometricLabelText] = useState("Fingerprint");

  useEffect(() => {
    let mounted = true;
    void isBiometricEnabled().then((enabled) => { if (mounted) setBiometricReady(enabled); });
    void biometricLabel().then((label) => { if (mounted) setBiometricLabelText(label); });
    return () => { mounted = false; };
  }, []);

  const tryBiometrics = async () => {
    setError(undefined);
    const ok = await authenticateWithBiometrics();
    if (ok) onUnlock();
  };

  useEffect(() => {
    if (biometricReady) void tryBiometrics();
  }, [biometricReady]);

  const submitPin = async () => {
    setChecking(true); setError(undefined);
    const ok = await verifyPin(pin);
    setChecking(false);
    if (ok) onUnlock();
    else { setError("Incorrect PIN."); setPin(""); }
  };

  return <View style={{ flex: 1, backgroundColor: colors.paper, alignItems: "center", justifyContent: "center", padding: 32, paddingTop: 32 + insets.top, paddingBottom: 32 + insets.bottom, gap: 16 }}>
    <Text style={{ color: colors.ink, fontFamily: fonts.display, fontSize: 26 * fontScale }}>NotesChain is locked</Text>
    <Text style={{ color: colors.muted, fontSize: 15 * fontScale, textAlign: "center" }}>Enter your PIN to continue.</Text>
    <Field
      value={pin}
      onChangeText={(value) => { setError(undefined); setPin(value.replace(/[^0-9]/g, "").slice(0, 6)); }}
      keyboardType="number-pad"
      secureTextEntry
      maxLength={6}
      placeholder="PIN"
      autoFocus
      style={{ textAlign: "center", fontSize: 24, letterSpacing: 8, width: 190 }}
    />
    {error ? <ErrorText>{error}</ErrorText> : null}
    <Action title={checking ? "Checking…" : "Unlock"} disabled={checking || pin.length < 4} onPress={() => void submitPin()} />
    {biometricReady ? <Action title={`Use ${biometricLabelText.toLowerCase()} instead`} tone="secondary" onPress={() => void tryBiometrics()} /> : null}
  </View>;
}
