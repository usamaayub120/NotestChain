import { useState } from "react";
import { KeyboardAvoidingView, Modal, Platform, ScrollView, Text, View } from "react-native";
import { Action, ErrorText, Field, Subtitle } from "@/src/components/ui";
import { useTheme } from "@/src/lib/theme";

/**
 * Mirrors packages/validation/src/reports.ts — createReportSchema requires a
 * non-empty reason of at most REPORT_REASON_MAX_LENGTH characters. Kept as a
 * literal because the mobile workspace has no dependency on @noteschain/*.
 */
const REASON_MAX = 500;
/**
 * The count stays out of the way until the limit is actually near, the same way
 * apps/web NoteCounter only surfaces a number once there is something to act on.
 */
const COUNTER_VISIBLE_AT = 125;

export function ReportDialog({
  visible,
  submitting,
  error,
  onCancel,
  onSubmit,
}: {
  visible: boolean;
  submitting: boolean;
  error?: string;
  onCancel: () => void;
  onSubmit: (reason: string) => void;
}) {
  const { colors, fontScale } = useTheme();
  const [reason, setReason] = useState("");
  const trimmed = reason.trim();
  const remaining = REASON_MAX - reason.length;

  const cancel = () => { setReason(""); onCancel(); };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={cancel}
      // VoiceOver and TalkBack otherwise keep reaching the page behind this
      // dialog by swipe, because a transparent Modal does not imply modality
      // to assistive technology on its own.
      accessibilityViewIsModal
    >
      {/* The field autofocuses, so the keyboard opens the moment this mounts.
          With the dialog centred and the Cancel/Send row beneath the field,
          the keyboard covered Send and the only way out was the hardware back
          button. Android Modals do not inherit the activity's adjustResize,
          so this has to be explicit. */}
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.55)" }}
      >
        <ScrollView
          contentContainerStyle={{ flexGrow: 1, justifyContent: "center", padding: 24 }}
          keyboardShouldPersistTaps="handled"
        >
        <View style={{ backgroundColor: colors.surface, borderRadius: 16, padding: 20, gap: 12, borderWidth: 1, borderColor: colors.border }}>
          <Text accessibilityRole="header" style={{ color: colors.ink, fontSize: 20 * fontScale, fontWeight: "700" }}>
            Report this note
          </Text>
          <Subtitle>A moderator reads every report.</Subtitle>
          <Field
            multiline
            autoFocus
            maxLength={REASON_MAX}
            placeholder="What needs attention?"
            value={reason}
            onChangeText={setReason}
            style={{ minHeight: 110, textAlignVertical: "top" }}
          />
          {remaining <= COUNTER_VISIBLE_AT ? (
            <Text style={{ color: remaining === 0 ? colors.danger : colors.muted, fontSize: 13 * fontScale }}>
              {remaining} {remaining === 1 ? "character" : "characters"} left
            </Text>
          ) : null}
          {error ? <ErrorText>{error}</ErrorText> : null}
          <View style={{ flexDirection: "row", gap: 10, justifyContent: "flex-end" }}>
            <Action title="Cancel" tone="secondary" disabled={submitting} onPress={cancel} />
            <Action
              title={submitting ? "Sending…" : "Send report"}
              disabled={submitting || trimmed.length === 0}
              onPress={() => { onSubmit(trimmed); setReason(""); }}
            />
          </View>
        </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </Modal>
  );
}
