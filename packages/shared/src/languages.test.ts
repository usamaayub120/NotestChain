import { describe, expect, it } from "vitest";
import { defaultNoteLanguage, FinalSpeechResults, insertDictatedText, noteLanguage } from "./languages.js";

describe("dictation text", () => {
  it("selects supported device languages and falls back to English", () => {
    expect(defaultNoteLanguage("ur-PK")).toBe("ur");
    expect(defaultNoteLanguage("ar_SA")).toBe("ar");
    expect(defaultNoteLanguage("ja-JP")).toBe("en");
    expect(noteLanguage("ar").rtl).toBe(true);
  });
  it("inserts at a caret without losing concurrent typed text", () => {
    expect(insertDictatedText("Hello there", { start: 5, end: 5 }, "new words")).toEqual({ value: "Hello new words there", caret: 15 });
    expect(insertDictatedText("Already typed", { start: 13, end: 13 }, "next phrase").value).toBe("Already typed next phrase");
  });
  it("replaces only selected text and handles Unicode and out-of-range selections", () => {
    expect(insertDictatedText("keep OLD ending", { start: 5, end: 8 }, "نیا").value).toBe("keep نیا ending");
    expect(insertDictatedText("🌊", { start: 999, end: 999 }, "hello").value).toBe("🌊 hello");
  });
  it("commits each final result once, never saving interim text", () => {
    const results = new FinalSpeechResults();
    expect(results.accept(0, "unfinished", false)).toBeNull();
    expect(results.accept(0, "finished", true)).toBe("finished");
    expect(results.accept(0, "finished again", true)).toBeNull();
    expect(results.accept(1, "finished", true)).toBe("finished");
  });
});
