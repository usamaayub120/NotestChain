import { describe, expect, it, vi } from "vitest";
import { TranslationController } from "./translation-controller.js";
import type { NoteLanguage, NoteTranslation } from "./languages.js";
const result = (targetLang: NoteLanguage): NoteTranslation => ({ translatedTitle: "Translated title", translatedText: "Translated body", targetLang, contentFormat: "PLAINTEXT" });
function deferred<T>() { let resolve!: (value: T) => void; let reject!: (reason: unknown) => void; const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; }); return { promise, resolve, reject }; }

describe("publication translation state", () => {
  it("retains the visible translation while changing language and caches successful results", async () => {
    const second = deferred<NoteTranslation>();
    const fetcher = vi.fn().mockResolvedValueOnce(result("ur")).mockReturnValueOnce(second.promise);
    const controller = new TranslationController(fetcher);
    await controller.translate("ur");
    const request = controller.translate("fr");
    expect(controller.getSnapshot()).toMatchObject({ loading: true, translation: { targetLang: "ur" } });
    second.resolve(result("fr")); await request;
    controller.original(); expect(controller.getSnapshot().showTranslation).toBe(false);
    await controller.translate("ur"); expect(fetcher).toHaveBeenCalledTimes(2);
  });
  it("ignores a superseded response, even when its fetcher ignores abort", async () => {
    const first = deferred<NoteTranslation>();
    const controller = new TranslationController(vi.fn().mockReturnValueOnce(first.promise).mockResolvedValueOnce(result("de")));
    const request = controller.translate("ar"); await controller.translate("de");
    first.resolve(result("ar")); await request;
    expect(controller.getSnapshot().translation?.targetLang).toBe("de");
  });
  it("ignores results after navigating away or choosing original", async () => {
    const pending = deferred<NoteTranslation>();
    const controller = new TranslationController(() => pending.promise);
    const request = controller.translate("es"); controller.original();
    pending.resolve(result("es")); await request;
    expect(controller.getSnapshot()).toMatchObject({ loading: false, showTranslation: false });
    expect(controller.getSnapshot().translation).toBeUndefined();
  });
  it("offers retry after failure and distinguishes sign-in", async () => {
    const controller = new TranslationController(vi.fn().mockRejectedValueOnce(new Error("You're offline.")).mockRejectedValueOnce({ status: 401 }));
    await controller.translate("fr"); expect(controller.getSnapshot()).toMatchObject({ loading: false, error: "You're offline.", requestedLanguage: "fr" });
    await controller.translate("fr"); expect(controller.getSnapshot().signInRequired).toBe(true);
  });
});
