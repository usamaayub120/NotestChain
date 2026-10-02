import { Router } from "express";
import { z } from "zod";
import { asyncHandler, ok } from "../../lib/http.js";
import { Errors } from "../../lib/apiError.js";
import { requireAuth } from "../../middleware/auth.js";
import { translateText, translateSchema } from "./translations.service.js";

export const translationsRouter = Router();

/**
 * Translate text endpoint
 * POST /api/v1/translate
 * Body: { text: string, targetLang: string }
 * Returns: { translatedText: string }
 */
translationsRouter.post(
  "/",
  requireAuth,
  asyncHandler(async (req, res) => {
    const input = translateSchema.parse(req.body);
    const result = await translateText(input.text, input.targetLang);
    return ok(res, result);
  })
);