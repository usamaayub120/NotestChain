import { requireOptionalNativeModule } from "expo";
import { speechErrorMessage } from "@noteschain/shared";

type SpeechModule = typeof import("expo-speech-recognition").ExpoSpeechRecognitionModule;
export const nativeSpeech = requireOptionalNativeModule<SpeechModule>("ExpoSpeechRecognition");
type Snapshot = { phase: "idle" | "starting" | "listening" | "stopping"; interim: string; error?: string };

export class NativeDictation {
  private generation = 0;
  private active = false;
  private subscriptions: { remove(): void }[] = [];
  private state: Snapshot = { phase: "idle", interim: "" };
  private listeners = new Set<() => void>();
  onFinal: (text: string) => void = () => {};
  constructor(private speech: SpeechModule | null = nativeSpeech) {}
  getSnapshot = () => this.state;
  subscribe = (listener: () => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; };
  private update(next: Snapshot) { this.state = next; this.listeners.forEach((listener) => listener()); }
  private removeListeners() { this.subscriptions.forEach((listener) => listener.remove()); this.subscriptions = []; }
  async start(locale: string) {
    if (this.active) return;
    if (!this.speech?.isRecognitionAvailable()) { this.update({ phase: "idle", interim: "", error: "Dictation isn't available on this device or app build. You can continue typing." }); return; }
    const speech = this.speech;
    const generation = ++this.generation;
    const current = () => generation === this.generation;
    this.active = true;
    this.update({ phase: "starting", interim: "" });
    try {
      const permission = await speech.requestPermissionsAsync();
      if (!current()) return;
      if (!permission.granted) throw new Error(speechErrorMessage("not-allowed"));
      // Some services cannot enumerate locales. Let recognition report support in that case.
      const supported = await speech.getSupportedLocales({}).catch(() => ({ locales: [] as string[] }));
      if (!current()) return;
      const normalize = (value: string) => value.toLowerCase().replace(/_/g, "-");
      const matching = supported.locales.find((value) => normalize(value) === normalize(locale)) ?? supported.locales.find((value) => normalize(value).split("-")[0] === normalize(locale).split("-")[0]);
      if (supported.locales.length && !matching) throw new Error(speechErrorMessage("language-not-supported"));
      let lastFinal: string | undefined;
      this.subscriptions = [
        speech.addListener("start", () => { if (current()) this.update({ phase: "listening", interim: "" }); }),
        speech.addListener("result", (event) => {
          if (!current()) return;
          const text = event.results[0]?.transcript ?? "";
          // Native continuous results contain the new utterance, unlike the browser's
          // indexed result list. Suppress repeated finals until the next interim segment.
          const signature = JSON.stringify([text, event.results[0]?.segments]);
          if (!event.isFinal) lastFinal = undefined;
          else if (text.trim() && signature !== lastFinal) { lastFinal = signature; this.onFinal(text.trim()); }
          if (current()) this.update({ ...this.state, interim: event.isFinal ? "" : text });
        }),
        speech.addListener("error", (event) => {
          if (!current()) return;
          this.cancel();
          if (event.error !== "aborted") this.update({ phase: "idle", interim: "", error: speechErrorMessage(event.error) });
        }),
        speech.addListener("end", () => { if (current()) { this.active = false; ++this.generation; this.removeListeners(); this.update({ phase: "idle", interim: "" }); } }),
      ];
      // The device keeps this session open where supported. An end or error never
      // creates a replacement session automatically.
      speech.start({ lang: matching ?? locale, interimResults: true, continuous: true, recordingOptions: { persist: false } });
    } catch (error) {
      if (!current()) return;
      this.cancel();
      this.update({ phase: "idle", interim: "", error: error instanceof Error ? error.message : "Dictation couldn't start. Please try again." });
    }
  }
  stop = () => {
    if (!this.active) return;
    if (this.state.phase === "starting") { this.cancel(); return; }
    this.update({ ...this.state, phase: "stopping" });
    try { this.speech?.stop(); } catch { this.cancel(); }
  };
  cancel = () => {
    const wasActive = this.active;
    this.active = false;
    ++this.generation;
    this.removeListeners();
    if (wasActive) { try { this.speech?.abort(); } catch { /* Already ended. */ } }
    this.update({ phase: "idle", interim: "" });
  };
}
