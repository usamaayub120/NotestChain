import { ActivityIndicator, Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { WebView } from "react-native-webview";
import { captchaPageUrl, parseCaptchaMessage } from "@/src/lib/captcha";
import { webOrigin } from "@/src/lib/config";
import { useTheme } from "@/src/lib/theme";
import { fonts } from "@/src/lib/fonts";

/**
 * Keeps Turnstile in the native app rather than handing registration to the
 * device browser. Turnstile itself is web technology, so it is hosted on our
 * first-party HTTPS origin and reports its short-lived token to this sheet.
 */
export function CaptchaSheet({ visible, onVerified, onCancel }: {
  visible: boolean;
  onVerified: (token: string) => void;
  onCancel: () => void;
}) {
  const { colors } = useTheme();

  return <Modal visible={visible} animationType="slide" presentationStyle="fullScreen" onRequestClose={onCancel}>
    <View style={[styles.screen, { backgroundColor: colors.paper }]}>
      <View style={styles.header}>
        <View style={styles.copy}>
          <Text style={[styles.title, { color: colors.ink }]}>Quick verification</Text>
          <Text style={[styles.subtitle, { color: colors.muted }]}>Complete this security check without leaving NotesChain.</Text>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Cancel verification"
          onPress={onCancel}
          hitSlop={10}
          style={({ pressed }) => [styles.cancel, { borderColor: colors.border, opacity: pressed ? 0.7 : 1 }]}
        >
          <Text style={{ color: colors.ink, fontWeight: "700" }}>Cancel</Text>
        </Pressable>
      </View>
      <WebView
        source={{ uri: captchaPageUrl() }}
        // Allow Turnstile's nested HTTPS frame to load, but never let the
        // top-level sheet leave our first-party page (or trigger a browser).
        originWhitelist={["http://*", "https://*"]}
        onMessage={(event) => {
          const token = parseCaptchaMessage(event.nativeEvent.data);
          if (token) onVerified(token);
        }}
        onShouldStartLoadWithRequest={(request) => !request.isTopFrame || request.url.startsWith(webOrigin)}
        startInLoadingState
        renderLoading={() => <View style={styles.loading}><ActivityIndicator color={colors.brand} /><Text style={{ color: colors.muted }}>Loading verification…</Text></View>}
        javaScriptEnabled
        domStorageEnabled
        style={styles.webView}
      />
    </View>
  </Modal>;
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  header: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 22, paddingTop: 20, paddingBottom: 14 },
  copy: { flex: 1, gap: 3 },
  title: { fontFamily: fonts.display, fontSize: 22 },
  subtitle: { fontSize: 13, lineHeight: 18 },
  cancel: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10 },
  webView: { flex: 1 },
  loading: { ...StyleSheet.absoluteFillObject, alignItems: "center", justifyContent: "center", gap: 10 },
});
