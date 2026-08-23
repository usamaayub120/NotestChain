import { Modal, Text, View } from "react-native";
import { Action, ErrorText } from "@/src/components/ui";
import { useTheme } from "@/src/lib/theme";

/**
 * Copy mirrors apps/web's PublicationWarningDialog so the two clients never
 * diverge on this claim — confirming here writes acknowledgeIrreversible: true,
 * which the server requires before it will touch the chain.
 */
export function PublishConfirmSheet({
  visible,
  publishing,
  error,
  onCancel,
  onConfirm,
}: {
  visible: boolean;
  publishing: boolean;
  error?: string;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const { colors } = useTheme();
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.55)", justifyContent: "center", padding: 24 }}>
        <View style={{ backgroundColor: colors.surface, borderRadius: 16, padding: 20, gap: 14, borderWidth: 1, borderColor: colors.border }}>
          <Text accessibilityRole="header" style={{ color: colors.ink, fontSize: 20, fontWeight: "700" }}>Publish permanently?</Text>
          <Text style={{ color: colors.muted, fontSize: 15, lineHeight: 21 }}>
            This note will be written to a public blockchain. It cannot be edited or deleted after this point, and it may remain publicly accessible even if it is later hidden or delisted from the site.
          </Text>
          {error ? <ErrorText>{error}</ErrorText> : null}
          <View style={{ flexDirection: "row", gap: 10, justifyContent: "flex-end" }}>
            <Action title="Cancel" tone="secondary" disabled={publishing} onPress={onCancel} />
            <Action title={publishing ? "Publishing…" : "Publish permanently"} tone="danger" disabled={publishing} onPress={onConfirm} />
          </View>
        </View>
      </View>
    </Modal>
  );
}
