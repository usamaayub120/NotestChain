import { Modal, Pressable, ScrollView, Text, View } from "react-native";
import { NOTE_LANGUAGES, type NoteLanguage } from "@noteschain/shared";
import { Action } from "@/src/components/ui";
import { fonts } from "@/src/lib/fonts";
import { useTheme } from "@/src/lib/theme";

export function LanguageSheet({ visible, title, selected, onSelect, onClose }: { visible: boolean; title: string; selected?: NoteLanguage; onSelect: (language: NoteLanguage) => void; onClose: () => void }) {
  const { colors, fontScale } = useTheme();
  return <Modal visible={visible} transparent animationType="none" accessibilityViewIsModal onRequestClose={onClose}>
    <View style={{ flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(0,0,0,0.55)" }}>
      <ScrollView contentContainerStyle={{ padding: 24, paddingBottom: 40, gap: 10, backgroundColor: colors.surface, borderTopLeftRadius: 16, borderTopRightRadius: 16 }} style={{ maxHeight: "85%" }}>
        <Text accessibilityRole="header" style={{ color: colors.ink, fontFamily: fonts.display, fontSize: 21 * fontScale, fontWeight: "700" }}>{title}</Text>
        {NOTE_LANGUAGES.map((language) => <Pressable key={language.code} accessibilityRole="radio" accessibilityState={{ checked: selected === language.code }} onPress={() => onSelect(language.code)} style={({ pressed }) => ({ minHeight: 48, padding: 14, borderRadius: 12, backgroundColor: pressed || selected === language.code ? colors.soft : colors.surface })}><Text style={{ color: colors.ink, fontFamily: fonts.body, fontSize: 16 * fontScale }}>{language.label}{selected === language.code ? " ✓" : ""}</Text></Pressable>)}
        <Action title="Cancel" tone="secondary" onPress={onClose} />
      </ScrollView>
    </View>
  </Modal>;
}
