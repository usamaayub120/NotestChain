import { useRef, useState } from "react";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { Modal, Pressable, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import { getToken } from "@/src/lib/api";
import { appName } from "@/src/lib/config";
import { createDraftAndOpen } from "@/src/lib/drafts";
import { useTheme } from "@/src/lib/theme";

/**
 * Left side of the top bar on the four root screens. The mark is the same
 * Ionicon the home screen already pairs with the wordmark, rather than
 * assets/icon.png — that file is a launcher icon with its own padding and
 * background plate, which reads badly scaled down into a 22px header slot.
 */
export function HeaderBrand() {
  const { colors, fontScale } = useTheme();
  return (
    <View accessible accessibilityRole="header" accessibilityLabel={appName} style={local.brand}>
      <Ionicons name="checkmark-circle" size={22} color={colors.brand} />
      <Text style={[local.wordmark, { color: colors.ink, fontSize: 17 * fontScale }]}>{appName}</Text>
    </View>
  );
}

/**
 * Right side of the top bar, everywhere except Account. React Native has no
 * popover primitive and the app carries no menu library, so the dropdown is a
 * transparent Modal positioned against the button's measured screen position —
 * the same Modal approach publish-confirm.tsx already uses.
 */
export function HeaderAddButton() {
  const { colors, fontScale } = useTheme();
  const { width } = useWindowDimensions();
  const buttonRef = useRef<View>(null);
  const [anchor, setAnchor] = useState<{ top: number; right: number } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();

  const open = () => {
    setError(undefined);
    buttonRef.current?.measureInWindow((x, y, buttonWidth, buttonHeight) => {
      setAnchor({ top: y + buttonHeight + 6, right: Math.max(width - (x + buttonWidth), 8) });
    });
  };

  const close = () => { setAnchor(null); setError(undefined); };

  const startDrafting = async () => {
    setBusy(true);
    setError(undefined);
    try {
      // Signed out, there is nothing to draft into — send them to Account
      // rather than failing the request with a 401.
      if (!(await getToken())) { close(); router.push("/account"); return; }
      await createDraftAndOpen();
      close();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not start a draft.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <Pressable
        ref={buttonRef}
        accessibilityRole="button"
        accessibilityLabel="Write a note"
        accessibilityHint="Open writing options"
        accessibilityState={{ expanded: anchor !== null }}
        onPress={open}
        style={({ pressed }) => [local.addButton, { backgroundColor: colors.soft }, pressed && local.pressed]}
      >
        <Ionicons name="add" size={20} color={colors.ink} />
        <Text style={[local.addLabel, { color: colors.ink, fontSize: 14 * fontScale }]}>Write</Text>
      </Pressable>

      <Modal visible={anchor !== null} transparent animationType="fade" onRequestClose={close}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Close menu"
          onPress={close}
          style={StyleSheet.absoluteFill}
        />
        {anchor ? (
          <View
            accessibilityRole="menu"
            style={[local.menu, { top: anchor.top, right: anchor.right, backgroundColor: colors.surface, borderColor: colors.border }]}
          >
            <Pressable
              accessibilityRole="menuitem"
              accessibilityState={{ disabled: busy }}
              disabled={busy}
              onPress={() => void startDrafting()}
              style={({ pressed }) => [local.menuItem, pressed && local.pressed, busy && local.disabled]}
            >
              <Ionicons name="create-outline" size={19} color={colors.ink} />
              <Text style={[local.menuLabel, { color: colors.ink, fontSize: 16 * fontScale }]}>
                {busy ? "Starting…" : "Start drafting"}
              </Text>
            </Pressable>
            {error ? (
              <Text accessibilityRole="alert" style={[local.menuError, { color: colors.danger, fontSize: 14 * fontScale }]}>
                {error}
              </Text>
            ) : null}
          </View>
        ) : null}
      </Modal>
    </>
  );
}

const local = StyleSheet.create({
  brand: { flexDirection: "row", alignItems: "center", gap: 8 },
  wordmark: { fontWeight: "700", letterSpacing: -0.2 },
  addButton: { minWidth: 72, minHeight: 44, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 3, borderRadius: 20, paddingHorizontal: 10 },
  addLabel: { fontWeight: "700" },
  pressed: { opacity: 0.6 },
  disabled: { opacity: 0.5 },
  menu: { position: "absolute", minWidth: 208, borderWidth: 1, borderRadius: 14, paddingVertical: 6, boxShadow: "0 6px 16px rgba(32, 30, 27, 0.16)" },
  menuItem: { flexDirection: "row", alignItems: "center", gap: 10, minHeight: 48, paddingHorizontal: 14 },
  menuLabel: { fontWeight: "600" },
  menuError: { paddingHorizontal: 14, paddingTop: 2, paddingBottom: 6, lineHeight: 19 },
});
