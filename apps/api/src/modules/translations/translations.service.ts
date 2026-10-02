import { createHash } from "node:crypto";
import { z } from "zod";
import { markdownToPlainText, NOTE_LANGUAGE_CODES, type NoteLanguage, type NoteTranslation } from "@noteschain/shared";
import { env } from "../../config/env.js";
import { ApiError, Errors } from "../../lib/apiError.js";
import { prisma } from "../../lib/prisma.js";

export const publicationTranslateSchema = z.object({ targetLang: z.enum(NOTE_LANGUAGE_CODES) }).strict();
export const translateSchema = publicationTranslateSchema.extend({ text: z.string().min(1).max(20_000) });
const azureResponse = z.array(z.object({ translations: z.array(z.object({ text: z.string(), to: z.string() })).min(1) }));

export async function translateAzure(texts: string[], targetLang: NoteLanguage): Promise<string[]> {
  if (!env.AZURE_TRANSLATOR_KEY || !env.AZURE_TRANSLATOR_REGION) {
    throw new ApiError(503, "TRANSLATION_UNAVAILABLE", "Translation isn't configured yet. You can still read the original.");
  }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15_000);
  try {
    const parts = await Promise.all(Array.from({ length: Math.ceil(texts.length / 1000) }, async (_, batch) => {
      const input = texts.slice(batch * 1000, (batch + 1) * 1000);
      const response = await fetch(`https://api.cognitive.microsofttranslator.com/translate?api-version=3.0&to=${targetLang}&textType=plain`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Ocp-Apim-Subscription-Key": env.AZURE_TRANSLATOR_KEY!, "Ocp-Apim-Subscription-Region": env.AZURE_TRANSLATOR_REGION! },
        body: JSON.stringify(input.map((Text) => ({ Text }))), signal: controller.signal,
      });
      if (response.status === 403 || response.status === 429) throw new ApiError(503, "TRANSLATION_QUOTA", "The translation service has reached its limit. Try again later or read the original.");
      if (!response.ok) throw new ApiError(503, "TRANSLATION_UNAVAILABLE", "Translation is temporarily unavailable. Try again later.");
      const parsed = azureResponse.safeParse(await response.json());
      if (!parsed.success || parsed.data.length !== input.length) throw new ApiError(503, "TRANSLATION_UNAVAILABLE", "The translation service returned an incomplete result. Please try again.");
      return parsed.data.map((entry) => {
        const translation = entry.translations.find((item) => item.to === targetLang);
        if (!translation?.text.trim()) throw new ApiError(503, "TRANSLATION_UNAVAILABLE", "The translation service returned an empty result. Please try again.");
        return translation.text;
      });
    }));
    return parts.flat();
  } catch (error) {
    const timedOut = controller.signal.aborted;
    controller.abort();
    if (error instanceof ApiError) throw error;
    throw new ApiError(503, timedOut ? "TRANSLATION_TIMEOUT" : "TRANSLATION_UNAVAILABLE", "Translation couldn't finish. Please try again or read the original.");
  } finally { clearTimeout(timer); }
}

function textParts(text: string) {
  const pieces = text.split(/(\r?\n+)/);
  const indexes = pieces.map((piece, index) => piece.trim() && !/^\r?\n/.test(piece) ? index : -1).filter((index) => index >= 0);
  return { pieces, indexes };
}

/** Compatibility endpoint for already-installed clients. Never simulated output. */
export async function translateText(text: string, targetLang: NoteLanguage) {
  const { pieces, indexes } = textParts(text);
  if (!indexes.length) throw Errors.badRequest("Text must contain words to translate.");
  const translated = await translateAzure(indexes.map((index) => pieces[index]!), targetLang);
  indexes.forEach((index, i) => { pieces[index] = translated[i]!; });
  return { translatedText: pieces.join("") };
}

// The deployment has one API process. The DB unique key also prevents duplicate rows.
const pending = new Map<string, Promise<NoteTranslation>>();
export async function translatePublication(id: string, targetLang: NoteLanguage): Promise<NoteTranslation> {
  const publication = await prisma.publication.findUnique({ where: { id } });
  if (!publication?.isPlatformVisible) throw Errors.notFound("Publication not found.");
  const body = publication.contentFormat === "MARKDOWN" ? markdownToPlainText(publication.content) : publication.content;
  const sourceDigest = createHash("sha256").update(JSON.stringify(["azure-v3-plain-v1", publication.title, body])).digest("hex");
  const key = { publicationId: id, targetLang, sourceDigest };
  const cached = await prisma.publicationTranslation.findUnique({ where: { publicationId_targetLang_sourceDigest: key } });
  if (cached) return { translatedTitle: cached.translatedTitle, translatedText: cached.translatedText, targetLang, contentFormat: "PLAINTEXT" };
  const pendingKey = JSON.stringify(key);
  const existing = pending.get(pendingKey);
  if (existing) return existing;
  const job = (async (): Promise<NoteTranslation> => {
    const { pieces, indexes } = textParts(body);
    const translated = await translateAzure([publication.title, ...indexes.map((index) => pieces[index]!)], targetLang);
    indexes.forEach((index, i) => { pieces[index] = translated[i + 1]!; });
    const result: NoteTranslation = { translatedTitle: translated[0]!, translatedText: pieces.join(""), targetLang, contentFormat: "PLAINTEXT" };
    await prisma.publicationTranslation.upsert({ where: { publicationId_targetLang_sourceDigest: key }, create: { ...key, translatedTitle: result.translatedTitle, translatedText: result.translatedText }, update: {} });
    return result;
  })();
  pending.set(pendingKey, job);
  try { return await job; } finally { pending.delete(pendingKey); }
}
