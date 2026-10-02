import { FinalSpeechResults, speechErrorMessage } from "@noteschain/shared";

export interface SpeechResultEvent {
  resultIndex: number;
  results: ArrayLike<{ isFinal: boolean; 0: { transcript: string } }>;
}
export interface BrowserRecognizer {
  lang: string; continuous: boolean; interimResults: boolean;
  onstart: (() => void) | null;
  onend: (() => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onresult: ((event: SpeechResultEvent) => void) | null;
  start(): void; stop(): void; abort(): void;
}
export type RecognizerConstructor = new () => BrowserRecognizer;
export function browserRecognizer(): RecognizerConstructor | undefined {
  const browser = window as unknown as { SpeechRecognition?: RecognizerConstructor; webkitSpeechRecognition?: RecognizerConstructor };
  return browser.SpeechRecognition ?? browser.webkitSpeechRecognition;
}
type Snapshot = { phase: "idle" | "starting" | "listening" | "stopping"; interim: string; error?: string };

/** Owns a single session. An abandoned recognizer can never insert into a new draft. */
export class BrowserDictation {
  private recognition?: BrowserRecognizer;
  private state: Snapshot = { phase: "idle", interim: "" };
  private listeners = new Set<() => void>();
  onFinal: (text: string) => void = () => {};
  constructor(private Constructor: RecognizerConstructor | undefined) {}
  get supported() { return Boolean(this.Constructor); }
  getSnapshot = () => this.state;
  subscribe = (listener: () => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; };
  private update(next: Snapshot) { this.state = next; this.listeners.forEach((listener) => listener()); }
  start(locale: string) {
    if (this.recognition) return;
    if (!this.Constructor) { this.update({ phase: "idle", interim: "", error: "Dictation isn't available in this browser. Try a browser with speech recognition or continue typing." }); return; }
    const recognition = new this.Constructor();
    const finalResults = new FinalSpeechResults();
    this.recognition = recognition;
    recognition.lang = locale; recognition.continuous = true; recognition.interimResults = true;
    const current = () => this.recognition === recognition;
    recognition.onstart = () => { if (current()) this.update({ phase: "listening", interim: "" }); };
    recognition.onresult = (event) => {
      if (!current()) return;
      for (let index = event.resultIndex; index < event.results.length; index++) {
        const result = event.results[index]!;
        const final = finalResults.accept(index, result[0].transcript, result.isFinal);
        if (final) this.onFinal(final);
      }
      const interim = Array.from(event.results).filter((result) => !result.isFinal).map((result) => result[0].transcript).join(" ");
      if (current()) this.update({ ...this.state, interim });
    };
    recognition.onerror = (event) => {
      if (!current()) return;
      this.cancel();
      if (event.error !== "aborted") this.update({ phase: "idle", interim: "", error: speechErrorMessage(event.error) });
    };
    recognition.onend = () => { if (current()) { this.recognition = undefined; this.update({ phase: "idle", interim: "" }); } };
    this.update({ phase: "starting", interim: "" });
    try { recognition.start(); } catch { this.cancel(); this.update({ phase: "idle", interim: "", error: "The speech service couldn't start. Please try again." }); }
  }
  stop = () => {
    if (!this.recognition) return;
    this.update({ ...this.state, phase: "stopping" });
    try { this.recognition.stop(); } catch { this.cancel(); }
  };
  cancel = () => {
    const recognition = this.recognition;
    this.recognition = undefined;
    if (recognition) {
      recognition.onstart = recognition.onresult = recognition.onend = recognition.onerror = null;
      try { recognition.abort(); } catch { /* Already ended. */ }
    }
    this.update({ phase: "idle", interim: "" });
  };
}
