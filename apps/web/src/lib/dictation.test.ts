import { beforeEach, describe, expect, it, vi } from "vitest";
import { BrowserDictation, type BrowserRecognizer, type SpeechResultEvent } from "./dictation";
class Recognizer implements BrowserRecognizer {
  static instances: Recognizer[] = [];
  lang = ""; continuous = false; interimResults = false;
  onstart: (() => void) | null = null; onend: (() => void) | null = null;
  onerror: ((event: { error: string }) => void) | null = null;
  onresult: ((event: SpeechResultEvent) => void) | null = null;
  start = vi.fn(() => this.onstart?.()); stop = vi.fn(); abort = vi.fn();
  constructor() { Recognizer.instances.push(this); }
}
const event = (text: string, isFinal: boolean): SpeechResultEvent => ({ resultIndex: 0, results: [{ isFinal, 0: { transcript: text } }] });
describe("browser dictation", () => {
  beforeEach(() => { Recognizer.instances = []; });
  it("inserts finals once, keeps interim separate, and starts the selected language", () => {
    const controller = new BrowserDictation(Recognizer); controller.onFinal = vi.fn(); controller.start("ur-PK");
    const recognition = Recognizer.instances[0]!;
    recognition.onresult?.(event("partial", false));
    expect(controller.onFinal).not.toHaveBeenCalled(); expect(controller.getSnapshot().interim).toBe("partial");
    recognition.onresult?.(event("final", true)); recognition.onresult?.(event("final", true));
    expect(controller.onFinal).toHaveBeenCalledExactlyOnceWith("final"); expect(recognition.lang).toBe("ur-PK");
  });
  it("accepts the final result after Stop and ignores abandoned sessions", () => {
    const controller = new BrowserDictation(Recognizer); controller.onFinal = vi.fn(); controller.start("en-US");
    const recognition = Recognizer.instances[0]!; controller.stop();
    recognition.onresult?.(event("last words", true)); expect(controller.onFinal).toHaveBeenCalledWith("last words");
    const staleResult = recognition.onresult!; controller.cancel(); controller.start("fr-FR"); staleResult(event("old callback", true));
    expect(controller.onFinal).toHaveBeenCalledTimes(1); expect(recognition.abort).toHaveBeenCalled();
  });
  it("handles permissions and retry without automatic restarts", () => {
    const controller = new BrowserDictation(Recognizer); controller.start("en-US"); Recognizer.instances[0]!.onerror?.({ error: "not-allowed" });
    expect(controller.getSnapshot()).toMatchObject({ phase: "idle", error: expect.stringContaining("denied") });
    expect(Recognizer.instances).toHaveLength(1); controller.start("en-US"); expect(Recognizer.instances).toHaveLength(2);
  });
  it("leaves typing available when the browser lacks a recognizer", () => {
    const controller = new BrowserDictation(undefined); controller.start("en-US"); expect(controller.getSnapshot().error).toContain("continue typing");
  });
});
