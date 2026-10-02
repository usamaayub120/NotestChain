import request from "supertest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createApp } from "../app.js";
import { env } from "../config/env.js";
import { prisma } from "../lib/prisma.js";
import { registerAndLogin, resetTestDb } from "./helpers.js";

const app = createApp();
const originalKey = env.AZURE_TRANSLATOR_KEY; const originalRegion = env.AZURE_TRANSLATOR_REGION;
const provider = vi.fn(async (_url: string, options: RequestInit) => Response.json((JSON.parse(options.body as string) as { Text: string }[]).map(({ Text }) => ({ translations: [{ to: "ur", text: `اردو ${Text}` }] }))));

async function fixture() {
  const session = await registerAndLogin(app);
  const publication = await prisma.publication.create({ data: { privateAuthorUserId: session.userId, identityMode: "NAMED", discoverability: "UNLISTED", title: "A kept thought", content: "**Hello**\n\nSecond paragraph", contentFormat: "MARKDOWN", excerpt: "Hello", contentHash: "immutable-proof-test", status: "PUBLISHED" } });
  return { session, publication, path: `/api/v1/publications/${publication.id}/translation` };
}

describe("publication translation HTTP contract", () => {
  beforeEach(async () => { await resetTestDb(); env.AZURE_TRANSLATOR_KEY = "test-only-key"; env.AZURE_TRANSLATOR_REGION = "test-region"; provider.mockClear(); vi.stubGlobal("fetch", provider); });
  afterEach(() => { vi.unstubAllGlobals(); env.AZURE_TRANSLATOR_KEY = originalKey; env.AZURE_TRANSLATOR_REGION = originalRegion; });
  it("requires authentication and browser CSRF", async () => {
    const { session, path } = await fixture();
    expect((await request(app).post(path).send({ targetLang: "ur" })).status).toBe(401);
    expect((await session.agent.post(path).send({ targetLang: "ur" })).status).toBe(403);
    expect(provider).not.toHaveBeenCalled();
    const response = await session.agent.post(path).set("x-csrf-token", session.csrfToken).send({ targetLang: "ur" });
    expect(response.status).toBe(200); expect(response.body.data).toMatchObject({ translatedTitle: "اردو A kept thought", translatedText: "اردو Hello\n\nاردو Second paragraph", targetLang: "ur", contentFormat: "PLAINTEXT" });
  });
  it("accepts verified native bearer sessions and preserves the publication", async () => {
    const { publication, path } = await fixture();
    const registration = await request(app).post("/api/v1/auth/mobile/register").send({ email: "translation-native@example.test", password: "strong-test-password", captchaToken: "test-bypass-token", acceptedTerms: true });
    const response = await request(app).post(path).set("authorization", `Bearer ${registration.body.data.session.token}`).send({ targetLang: "ur" });
    expect(response.status).toBe(200);
    const unchanged = await prisma.publication.findUniqueOrThrow({ where: { id: publication.id } });
    expect(unchanged).toMatchObject({ title: publication.title, content: publication.content, contentHash: publication.contentHash, excerpt: publication.excerpt });
  });
  it("coalesces simultaneous requests and serves cache without a configured provider", async () => {
    const { session, publication, path } = await fixture();
    const responses = await Promise.all([1, 2, 3].map(() => session.agent.post(path).set("x-csrf-token", session.csrfToken).send({ targetLang: "ur" })));
    expect(responses.map((response) => response.status)).toEqual([200, 200, 200]); expect(provider).toHaveBeenCalledTimes(1);
    expect(await prisma.publicationTranslation.count({ where: { publicationId: publication.id } })).toBe(1);
    env.AZURE_TRANSLATOR_KEY = undefined;
    expect((await session.agent.post(path).set("x-csrf-token", session.csrfToken).send({ targetLang: "ur" })).status).toBe(200);
    expect(provider).toHaveBeenCalledTimes(1);
  });
  it("checks visibility before serving cached text", async () => {
    const { session, publication, path } = await fixture();
    await session.agent.post(path).set("x-csrf-token", session.csrfToken).send({ targetLang: "ur" });
    await prisma.publication.update({ where: { id: publication.id }, data: { isPlatformVisible: false } });
    const response = await session.agent.post(path).set("x-csrf-token", session.csrfToken).send({ targetLang: "ur" });
    expect(response.status).toBe(404); expect(provider).toHaveBeenCalledTimes(1);
  });
  it("rejects unsupported languages and missing publications", async () => {
    const { session, path } = await fixture();
    expect((await session.agent.post(path).set("x-csrf-token", session.csrfToken).send({ targetLang: "xx" })).status).toBe(400);
    expect((await session.agent.post("/api/v1/publications/missing/translation").set("x-csrf-token", session.csrfToken).send({ targetLang: "ur" })).status).toBe(404);
    expect(provider).not.toHaveBeenCalled();
  });
  it("shares a per-account rate limit between the new and legacy endpoints", async () => {
    const { session, path } = await fixture();
    for (let i = 0; i < 10; i++) expect((await session.agent.post(path).set("x-csrf-token", session.csrfToken).send({ targetLang: "ur" })).status).toBe(200);
    const limited = await session.agent.post("/api/v1/translate").set("x-csrf-token", session.csrfToken).send({ text: "Hello", targetLang: "ur" });
    expect(limited.status).toBe(429); expect(limited.body.error.code).toBe("RATE_LIMITED");
  });
  it("keeps the legacy response envelope working with real provider output", async () => {
    const { session } = await fixture();
    const response = await session.agent.post("/api/v1/translate").set("x-csrf-token", session.csrfToken).send({ text: "Hello", targetLang: "ur" });
    expect(response.status).toBe(200); expect(response.body).toEqual({ data: { translatedText: "اردو Hello" } });
  });
});
