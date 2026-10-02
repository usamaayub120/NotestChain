import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { env } from "../../config/env.js";
import { translateAzure, translateSchema, translateText } from "./translations.service.js";
const key = env.AZURE_TRANSLATOR_KEY; const region = env.AZURE_TRANSLATOR_REGION;
describe("Azure translation adapter", () => {
  beforeEach(() => { env.AZURE_TRANSLATOR_KEY = "test-only-key"; env.AZURE_TRANSLATOR_REGION = "test-region"; });
  afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers(); env.AZURE_TRANSLATOR_KEY = key; env.AZURE_TRANSLATOR_REGION = region; });
  it("uses real provider output and preserves paragraph breaks for legacy clients", async () => {
    const fetcher = vi.fn().mockResolvedValue(Response.json([{ translations: [{ to: "fr", text: "Bonjour" }] }, { translations: [{ to: "fr", text: "Au revoir" }] }])); vi.stubGlobal("fetch", fetcher);
    expect(await translateText("Hello\n\nGoodbye", "fr")).toEqual({ translatedText: "Bonjour\n\nAu revoir" });
    expect(JSON.parse(fetcher.mock.calls[0]![1].body)).toEqual([{ Text: "Hello" }, { Text: "Goodbye" }]);
    expect(fetcher.mock.calls[0]![0]).not.toContain("from=");
  });
  it("fails clearly when configuration is missing", async () => {
    env.AZURE_TRANSLATOR_KEY = undefined;
    await expect(translateAzure(["hello"], "ur")).rejects.toMatchObject({ code: "TRANSLATION_UNAVAILABLE" });
  });
  it.each([403, 429])("handles quota exhaustion (%s)", async (status) => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("", { status })));
    await expect(translateAzure(["hello"], "ur")).rejects.toMatchObject({ code: "TRANSLATION_QUOTA" });
  });
  it("rejects empty, malformed, or incomplete results", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json([])));
    await expect(translateAzure(["hello"], "en")).rejects.toMatchObject({ code: "TRANSLATION_UNAVAILABLE" });
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json([{ translations: [{ to: "en", text: "" }] }])));
    await expect(translateAzure(["hello"], "en")).rejects.toMatchObject({ code: "TRANSLATION_UNAVAILABLE" });
  });
  it("enforces its 15-second deadline", async () => {
    vi.useFakeTimers();
    vi.stubGlobal("fetch", vi.fn((_url, init: RequestInit) => new Promise((_resolve, reject) => { init.signal!.addEventListener("abort", () => reject(new DOMException("Aborted", "AbortError"))); })));
    const request = expect(translateAzure(["hello"], "es")).rejects.toMatchObject({ code: "TRANSLATION_TIMEOUT" });
    await vi.advanceTimersByTimeAsync(15_000); await request;
  });
  it("bounds legacy payloads and restricts languages", () => {
    expect(translateSchema.safeParse({ text: "a".repeat(20001), targetLang: "en" }).success).toBe(false);
    expect(translateSchema.safeParse({ text: "hello", targetLang: "xx" }).success).toBe(false);
  });
});
