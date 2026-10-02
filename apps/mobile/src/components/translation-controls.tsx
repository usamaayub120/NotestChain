import { useState } from "react";
import { Ionicons } from "@expo/vector-icons";
import { Modal, Text, View } from "react-native";
import { noteLanguage, type NoteLanguage, type TranslationState } from "@noteschain/shared";
import { Action, ErrorText, Subtitle } from "@/src/components/ui";
import { LanguageSheet } from "@/src/components/language-sheet";
import { fonts } from "@/src/lib/fonts";
import { useTheme } from "@/src/lib/theme";

export function TranslationControls({ state, authenticated, onTranslate, onOriginal, onSignIn }: { state: TranslationState; authenticated: boolean; onTranslate: (language: NoteLanguage) => void; onOriginal: () => void; onSignIn: () => void }) {
  const { colors } = useTheme();
  const [choosing, setChoosing] = useState(false);
  const [signIn, setSignIn] = useState(false);
  return <View style={{ gap: 8 }}>
    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
      <Action title={state.loading ? "Translating…" : state.showTranslation ? "Change language" : "Translate"} tone="secondary" disabled={state.loading} icon={<Ionicons name="language-outline" size={18} color={colors.ink} />} onPress={() => authenticated ? setChoosing(true) : setSignIn(true)} />
      {state.showTranslation && <Action title="Show original" tone="secondary" onPress={onOriginal} />}
    </View>
    {state.showTranslation && state.translation && <Subtitle live>Translated to {noteLanguage(state.translation.targetLang).label}</Subtitle>}
    {state.loading && <Subtitle live>Translating this note…</Subtitle>}
    {state.error && <><ErrorText>{state.error}</ErrorText><Action title={state.signInRequired ? "Sign in" : "Try again"} tone="secondary" onPress={() => { if (state.signInRequired) onSignIn(); else if (state.requestedLanguage) onTranslate(state.requestedLanguage); }} /></>}
    <LanguageSheet visible={choosing} title="Translate this note" selected={state.translation?.targetLang} onClose={() => setChoosing(false)} onSelect={(language) => { setChoosing(false); onTranslate(language); }} />
    <Modal visible={signIn} transparent animationType="none" accessibilityViewIsModal onRequestClose={() => setSignIn(false)}><View style={{ flex: 1, justifyContent: "center", padding: 24, backgroundColor: "rgba(0,0,0,0.55)" }}><View style={{ gap: 14, padding: 24, borderRadius: 16, backgroundColor: colors.surface }}><Text accessibilityRole="header" style={{ color: colors.ink, fontFamily: fonts.display, fontSize: 21, fontWeight: "700" }}>Sign in to translate</Text><Subtitle>You'll return to this note after signing in.</Subtitle><Action title="Sign in" onPress={() => { setSignIn(false); onSignIn(); }} /><Action title="Keep reading" tone="secondary" onPress={() => setSignIn(false)} /></View></View></Modal>
  </View>;
}
