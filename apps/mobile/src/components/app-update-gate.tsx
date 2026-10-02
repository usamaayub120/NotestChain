import { useState } from "react";
import { Modal, Text, View } from "react-native";
import { openAndroidPlayStore, type AndroidVersionConfig, type UpdateStatus } from "@/src/lib/app-version";
import { Action, ErrorText, Subtitle } from "@/src/components/ui";
import { useTheme } from "@/src/lib/theme";
import { fonts } from "@/src/lib/fonts";

type Props = {
  status: Extract<UpdateStatus, "optional" | "required">;
  config: AndroidVersionConfig;
  onLater: () => void;
};

/** A required update replaces the navigator; optional updates use the app's existing modal pattern. */
export function AppUpdateGate({ status, config, onLater }: Props) {
  const { colors, fontScale } = useTheme();
  const [openingStore, setOpeningStore] = useState(false);
  const [storeError, setStoreError] = useState<string>();
  const required = status === "required";

  const openStore = async () => {
    setOpeningStore(true);
    setStoreError(undefined);
    const opened = await openAndroidPlayStore();
    setOpeningStore(false);
    if (opened) {
      if (!required) onLater();
      return;
    }
    setStoreError("Couldn’t open Google Play. Please update NotesChain from the Play Store.");
  };

  const content = <View style={{ backgroundColor: colors.surface, borderRadius: 16, padding: 22, gap: 14, borderWidth: 1, borderColor: colors.border, maxWidth: 460, width: "100%" }}>
    <Text accessibilityRole="header" style={{ color: colors.ink, fontFamily: fonts.display, fontSize: 26 * fontScale }}>
      {required ? "Update required" : "Update available"}
    </Text>
    <Subtitle>
      {required
        ? "A newer version of NotesChain is required to continue."
        : `Version ${config.latestVersion} is available. Update now for the latest improvements and fixes.`}
    </Subtitle>
    {storeError ? <ErrorText>{storeError}</ErrorText> : null}
    <View style={{ flexDirection: "row", gap: 10, justifyContent: "flex-end" }}>
      {!required ? <Action title="Later" tone="secondary" disabled={openingStore} onPress={onLater} /> : null}
      <Action title={openingStore ? "Opening Google Play…" : required ? "Update app" : "Update"} disabled={openingStore} onPress={() => void openStore()} />
    </View>
  </View>;

  if (required) {
    // This replaces the entire navigator, so Android back has no app route or
    // modal dismissal path to reveal. The only in-app action is Update app.
    return <View accessibilityViewIsModal style={{ flex: 1, backgroundColor: colors.paper, alignItems: "center", justifyContent: "center", padding: 24 }}>
      {content}
    </View>;
  }

  return <Modal visible transparent animationType="fade" onRequestClose={onLater}>
    <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.55)", justifyContent: "center", padding: 24, alignItems: "center" }}>
      {content}
    </View>
  </Modal>;
}
