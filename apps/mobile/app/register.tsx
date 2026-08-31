import { useState } from "react";
import { router } from "expo-router";
import * as Linking from "expo-linking";
import { Ionicons } from "@expo/vector-icons";
import { Switch, Text, View } from "react-native";
import { api, setToken } from "@/src/lib/api";
import { syncPushRegistration } from "@/src/lib/push";
import { Action, ErrorText, Field, IconButton, Notice, Screen, Subtitle, Title } from "@/src/components/ui";
import { useTheme } from "@/src/lib/theme";
import { webOrigin } from "@/src/lib/config";
import { CaptchaSheet } from "@/src/components/captcha-sheet";

const USERNAME_PATTERN = /^[a-z0-9][a-z0-9_-]{2,29}$/;

export default function RegisterScreen() {
  const { colors } = useTheme();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [username, setUsername] = useState("");
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);
  const [captchaOpen, setCaptchaOpen] = useState(false);

  const validUsername = USERNAME_PATTERN.test(username);

  const register = async (captchaToken: string) => {
    setBusy(true);
    setError(undefined);
    try {
      const result = await api<{ session: { token: string } }>("/auth/mobile/register", {
        method: "POST",
        body: JSON.stringify({
          email,
          password,
          captchaToken,
          acceptedTerms,
          username,
          displayName,
          deviceName: "NotesChain mobile",
        }),
      });
      await setToken(result.session.token);
      void syncPushRegistration();
      router.replace("/account");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not create account.");
    } finally {
      setBusy(false);
    }
  };

  const beginRegistration = () => {
    setError(undefined);
    setCaptchaOpen(true);
  };

  return (
    <Screen insetTop>
      <IconButton tone="plain" icon={<Ionicons name="arrow-back" size={24} color={colors.brand} />} accessibilityLabel="Go back" onPress={() => router.canGoBack() ? router.back() : router.replace("/account")} />
      <Title>Create your account</Title>
      <Subtitle>Your session is stored only in this device's secure storage.</Subtitle>

      <Field accessibilityLabel="Email address" autoCapitalize="none" autoComplete="email" keyboardType="email-address" placeholder="Email" value={email} onChangeText={setEmail} />
      <Field accessibilityLabel="Password" autoComplete="new-password" secureTextEntry placeholder="Password (at least 10 characters)" value={password} onChangeText={setPassword} />
      <Field accessibilityLabel="Your name" autoComplete="name" placeholder="Your name" value={displayName} onChangeText={setDisplayName} />
      <Field
        accessibilityLabel="Username"
        autoCapitalize="none"
        autoComplete="username-new"
        autoCorrect={false}
        placeholder="Username"
        value={username}
        onChangeText={(value) => setUsername(value.toLowerCase())}
      />
      <Subtitle>Your Keeper profile's address - lowercase letters, numbers, - or _ only. You can change it once.</Subtitle>

      <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
        <Switch
          value={acceptedTerms}
          onValueChange={setAcceptedTerms}
          trackColor={{ true: colors.brand }}
          accessibilityLabel="I agree to the Terms of Service and Privacy Policy"
        />
        <Text style={{ color: colors.ink, flex: 1, flexWrap: "wrap" }}>
          I agree to the{" "}
          <Text style={{ color: colors.brand, fontWeight: "700" }} onPress={() => Linking.openURL(`${webOrigin}/terms`)}>
            Terms of Service
          </Text>{" "}
          and{" "}
          <Text style={{ color: colors.brand, fontWeight: "700" }} onPress={() => Linking.openURL(`${webOrigin}/privacy`)}>
            Privacy Policy
          </Text>
          .
        </Text>
      </View>

      <Notice>Before creating your account, complete a quick verification here in the app.</Notice>
      {error && <ErrorText>{error}</ErrorText>}

      <Action
        title={busy ? "Creating…" : "Create account"}
        disabled={busy || !email || password.length < 10 || !displayName.trim() || !validUsername || !acceptedTerms}
        onPress={beginRegistration}
      />
      <CaptchaSheet
        visible={captchaOpen}
        onCancel={() => setCaptchaOpen(false)}
        onVerified={(captchaToken) => { setCaptchaOpen(false); void register(captchaToken); }}
      />
    </Screen>
  );
}
