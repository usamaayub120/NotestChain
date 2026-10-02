jest.mock("expo", () => ({ requireOptionalNativeModule: () => null }));
import { NativeDictation } from "./dictation";
type Speech = typeof import("expo-speech-recognition").ExpoSpeechRecognitionModule;
function speechFixture() {
  const listeners = new Map<string, (event: any) => void>();
  const speech = { isRecognitionAvailable: jest.fn(() => true), requestPermissionsAsync: jest.fn(async () => ({ granted: true })), getSupportedLocales: jest.fn(async () => ({ locales: ["en-US", "ur-IN"] })), start: jest.fn(), stop: jest.fn(), abort: jest.fn(), addListener: jest.fn((event: string, listener: (payload: any) => void) => { listeners.set(event, listener); return { remove: () => listeners.delete(event) }; }) };
  const controller = new NativeDictation(speech as unknown as Speech); controller.onFinal = jest.fn();
  return { controller, speech, listeners };
}
describe("native dictation", () => {
  it("requests permission, resolves supported regional variants, and never persists audio", async () => {
    const { controller, speech } = speechFixture(); await controller.start("ur-PK");
    expect(speech.start).toHaveBeenCalledWith(expect.objectContaining({ lang: "ur-IN", recordingOptions: { persist: false } }));
  });
  it("commits a final once and keeps interim text out of the draft", async () => {
    const { controller, listeners } = speechFixture(); await controller.start("en-US");
    const result = listeners.get("result")!;
    result({ isFinal: false, results: [{ transcript: "partial" }] }); expect(controller.onFinal).not.toHaveBeenCalled();
    result({ isFinal: true, results: [{ transcript: "finished" }] }); result({ isFinal: true, results: [{ transcript: "finished" }] });
    expect(controller.onFinal).toHaveBeenCalledTimes(1);
    result({ isFinal: true, results: [{ transcript: "next phrase" }] });
    result({ isFinal: false, results: [{ transcript: "finished" }] });
    result({ isFinal: true, results: [{ transcript: "finished" }] });
    expect(controller.onFinal).toHaveBeenCalledTimes(3);
  });
  it("ignores abandoned results and permission responses", async () => {
    const { controller, speech, listeners } = speechFixture(); await controller.start("en-US");
    const result = listeners.get("result")!; controller.cancel(); result({ isFinal: true, results: [{ transcript: "stale" }] }); expect(controller.onFinal).not.toHaveBeenCalled();
    let resolve!: (permission: { granted: boolean }) => void;
    speech.requestPermissionsAsync.mockImplementationOnce(() => new Promise((yes) => { resolve = yes; }));
    const start = controller.start("en-US"); controller.cancel(); resolve({ granted: true }); await start;
    expect(speech.start).toHaveBeenCalledTimes(1);
  });
  it("handles permission and language failures without restarting automatically", async () => {
    const { controller, speech } = speechFixture(); speech.requestPermissionsAsync.mockResolvedValueOnce({ granted: false });
    await controller.start("en-US"); expect(controller.getSnapshot().error).toContain("denied");
    await controller.start("de-DE"); expect(controller.getSnapshot().error).toContain("selected language"); expect(speech.start).not.toHaveBeenCalled();
  });
  it("retains the final phrase after Stop and cleans up at end", async () => {
    const { controller, speech, listeners } = speechFixture(); await controller.start("en-US"); listeners.get("start")?.({}); controller.stop();
    expect(speech.stop).toHaveBeenCalled(); listeners.get("result")?.({ isFinal: true, results: [{ transcript: "last words" }] }); listeners.get("end")?.({});
    expect(controller.onFinal).toHaveBeenCalledWith("last words"); expect(controller.getSnapshot().phase).toBe("idle"); expect(listeners.size).toBe(0);
  });
  it("allows typing when the installed binary has no speech module", async () => {
    const controller = new NativeDictation(null); await controller.start("en-US"); expect(controller.getSnapshot().error).toContain("continue typing");
  });
});
