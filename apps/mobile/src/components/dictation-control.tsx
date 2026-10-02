import { forwardRef, useEffect, useImperativeHandle, useRef, useState, useSyncExternalStore } from "react";
import { AppState, Linking, Modal, Text, View } from "react-native";
import { getLocales } from "expo-localization";
import * as SecureStore from "expo-secure-store";
import { Ionicons } from "@expo/vector-icons";
import { defaultNoteLanguage, DICTATION_DISCLOSURE, noteLanguage, type NoteLanguage } from "@noteschain/shared";
import { NativeDictation } from "@/src/lib/dictation";
import { Action, ErrorText, Subtitle } from "@/src/components/ui";
import { LanguageSheet } from "@/src/components/language-sheet";
import { fonts } from "@/src/lib/fonts";
import { useTheme } from "@/src/lib/theme";

export type DictationHandle = { cancel: () => void };
const LANGUAGE_KEY = "noteschain.dictation.language";
const CONSENT_KEY = "noteschain.dictation.disclosure.v1";
export const DictationControl = forwardRef<DictationHandle, { enabled: boolean; onFinal: (text: string) => void }>(function DictationControl({ enabled, onFinal }, ref) {
  const { colors } = useTheme();
  const [controller] = useState(() => new NativeDictation());
  const state = useSyncExternalStore(controller.subscribe, controller.getSnapshot);
  const [language, setLanguage] = useState<NoteLanguage>(() => defaultNoteLanguage(getLocales()[0]?.languageTag));
  const [choosing, setChoosing] = useState(false);
  const [disclosure, setDisclosure] = useState(false);
  const available = useRef(enabled);
  const startGeneration = useRef(0);
  const active = state.phase !== "idle";
  useImperativeHandle(ref, () => ({ cancel: () => { ++startGeneration.current; setDisclosure(false); controller.cancel(); } }), [controller]);
  useEffect(() => { controller.onFinal = onFinal; }, [controller, onFinal]);
  useEffect(() => { let mounted = true; void SecureStore.getItemAsync(LANGUAGE_KEY).then((stored) => { if (mounted && stored) setLanguage(noteLanguage(stored).code); }).catch(() => {}); return () => { mounted = false; }; }, []);
  useEffect(() => {
    available.current = enabled;
    const listener = AppState.addEventListener("change", (next) => { if (next !== "active") { ++startGeneration.current; setDisclosure(false); controller.cancel(); } });
    return () => { available.current = false; ++startGeneration.current; listener.remove(); controller.cancel(); };
  }, [controller, enabled]);
  const start = async () => {
    if (!available.current) return;
    const generation = ++startGeneration.current;
    const consented = await SecureStore.getItemAsync(CONSENT_KEY).catch(() => null);
    if (!available.current || generation !== startGeneration.current) return;
    if (consented !== "yes") { setDisclosure(true); return; }
    void controller.start(noteLanguage(language).locale);
  };
  return <View style={{ gap: 8 }}>
    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
      <Action title={noteLanguage(language).label} accessibilityLabel="Dictation language" tone="secondary" disabled={!enabled || active} onPress={() => setChoosing(true)} />
      <Action title={state.phase === "starting" ? "Starting…" : state.phase === "stopping" ? "Stopping…" : active ? "Stop dictation" : "Dictate"} tone="secondary" disabled={!enabled || state.phase === "stopping"} icon={<Ionicons name={active ? "stop-outline" : "mic-outline"} size={18} color={colors.ink} />} onPress={active ? controller.stop : () => void start()} />
    </View>
    {active && <Subtitle live>{state.phase === "listening" ? "Listening. Pause to finish, or tap Stop." : state.phase === "starting" ? "Starting dictation…" : "Finishing dictation…"}</Subtitle>}
    {state.interim && <Text style={{ color: colors.muted, writingDirection: noteLanguage(language).rtl ? "rtl" : "ltr" }}>{state.interim}</Text>}
    {state.error && <><ErrorText>{state.error}</ErrorText><Action title="Open device settings" tone="secondary" onPress={() => void Linking.openSettings()} /></>}
    <LanguageSheet visible={choosing} title="Dictation language" selected={language} onClose={() => setChoosing(false)} onSelect={(next) => { setLanguage(next); setChoosing(false); void SecureStore.setItemAsync(LANGUAGE_KEY, next).catch(() => {}); }} />
    <Modal visible={disclosure} transparent animationType="none" accessibilityViewIsModal onRequestClose={() => setDisclosure(false)}><View style={{ flex: 1, justifyContent: "center", padding: 24, backgroundColor: "rgba(0,0,0,0.55)" }}><View style={{ backgroundColor: colors.surface, borderRadius: 16, padding: 24, gap: 14 }}><Text accessibilityRole="header" style={{ color: colors.ink, fontFamily: fonts.display, fontSize: 21, fontWeight: "700" }}>Write with your voice</Text><Subtitle>{DICTATION_DISCLOSURE}</Subtitle><Action title="Start dictation" onPress={() => { setDisclosure(false); void SecureStore.setItemAsync(CONSENT_KEY, "yes").catch(() => {}); if (available.current) void controller.start(noteLanguage(language).locale); }} /><Action title="Cancel" tone="secondary" onPress={() => setDisclosure(false)} /></View></View></Modal>
  </View>;
});
