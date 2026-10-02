import { Ionicons } from "@expo/vector-icons";
import { StyleSheet, Text, View } from "react-native";
import { useTheme } from "@/src/lib/theme";
import { Action, styles } from "./ui";

/**
 * A failure the reader can act on, with a retry.
 *
 * The app had no equivalent: `ErrorText` is a bare red line with no control
 * attached, and the list screens never reached even that, because their query
 * functions caught the failure and returned `[]`. A reader who was offline,
 * or whose session had just expired, was told their drafts and saved notes
 * did not exist -  which on the drafts screen reads as lost work, not as a
 * failed request. apps/web's ErrorState has had this shape since it shipped.
 */
export function ErrorState({
  title = "We couldn't load this",
  detail,
  onRetry,
}: {
  title?: string;
  detail?: string;
  onRetry?: () => void;
}) {
  const { colors, fontScale } = useTheme();
  return (
    <View
      accessibilityRole="alert"
      style={[local.box, { borderColor: colors.border, backgroundColor: colors.elevated }]}
    >
      <Ionicons name="cloud-offline-outline" size={28} color={colors.danger} />
      <Text style={[local.title, { color: colors.ink, fontSize: 17 * fontScale }]}>{title}</Text>
      <Text style={[styles.subtitle, local.detail, { color: colors.muted, fontSize: 15 * fontScale }]}>
        {detail ?? "Check your connection and try again."}
      </Text>
      {onRetry && <Action title="Try again" tone="secondary" onPress={onRetry} />}
    </View>
  );
}

const local = StyleSheet.create({
  box: { marginBottom: 12, borderWidth: 1, borderRadius: 16, padding: 20, gap: 8, alignItems: "center" },
  title: { fontWeight: "700", textAlign: "center" },
  detail: { textAlign: "center" },
});
