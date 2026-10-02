export const NOTE_LANGUAGES = [
  { code: "en", label: "English", locale: "en-US", rtl: false },
  { code: "ur", label: "Urdu", locale: "ur-PK", rtl: true },
  { code: "ar", label: "Arabic", locale: "ar-SA", rtl: true },
  { code: "es", label: "Spanish", locale: "es-ES", rtl: false },
  { code: "fr", label: "French", locale: "fr-FR", rtl: false },
  { code: "de", label: "German", locale: "de-DE", rtl: false },
] as const;

export type NoteLanguage = typeof NOTE_LANGUAGES[number]["code"];
export const NOTE_LANGUAGE_CODES = ["en", "ur", "ar", "es", "fr", "de"] as const;
export const noteLanguage = (code: string) => NOTE_LANGUAGES.find((language) => language.code === code) ?? NOTE_LANGUAGES[0];
export const defaultNoteLanguage = (locale?: string): NoteLanguage => noteLanguage(locale?.split(/[-_]/)[0]?.toLowerCase() ?? "en").code;

export type NoteTranslation = {
  translatedTitle: string;
  translatedText: string;
  targetLang: NoteLanguage;
  contentFormat: "PLAINTEXT";
};

export const DICTATION_DISCLOSURE = "Your browser or device provides speech recognition and may send audio to its speech service. NotesChain does not store audio. Only finalized words enter your draft.";

export function speechErrorMessage(code: string): string {
  switch (code) {
    case "not-allowed": case "service-not-allowed": return "Microphone or speech access is denied. Allow it in your browser or device settings, then try again.";
    case "language-not-supported": return "This speech service cannot recognize the selected language. Choose another language or continue typing.";
    case "no-speech": case "speech-timeout": return "No speech was recognized. Try again when you're ready.";
    case "network": return "Speech recognition needs a connection. Check your internet connection and try again.";
    case "audio-capture": return "The microphone is unavailable. Check that another app isn't using it, then try again.";
    default: return "Dictation stopped. You can try again or continue typing.";
  }
}

/** Each recognizer session has its own result indexes; repeated final events are ignored. */
export class FinalSpeechResults {
  private committed = new Set<number>();
  accept(index: number, text: string, final: boolean): string | null {
    if (!final || !text.trim() || this.committed.has(index)) return null;
    this.committed.add(index);
    return text.trim();
  }
}

export function insertDictatedText(value: string, selection: { start: number; end: number }, phrase: string) {
  const start = Math.max(0, Math.min(selection.start, value.length));
  const end = Math.max(start, Math.min(selection.end, value.length));
  const before = value.slice(0, start);
  const after = value.slice(end);
  const insertion = `${before && !/\s$/.test(before) ? " " : ""}${phrase.trim()}${after && !/^\s/.test(after) ? " " : ""}`;
  return { value: before + insertion + after, caret: start + insertion.length };
}
