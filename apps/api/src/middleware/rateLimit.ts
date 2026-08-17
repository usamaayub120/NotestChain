import rateLimit from "express-rate-limit";
import { env } from "../config/env.js";

// In-memory store is fine for a single-container MVP with one API process
// (see ARCHITECTURE.md §3.6) — revisit if the API ever scales horizontally.
export const authRateLimit = rateLimit({
  windowMs: env.AUTH_RATE_LIMIT_WINDOW_MS,
  max: env.AUTH_RATE_LIMIT_MAX,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: { code: "RATE_LIMITED", message: "Too many attempts. Please try again later." } },
});

export const searchRateLimit = rateLimit({
  windowMs: 60_000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: { code: "RATE_LIMITED", message: "Too many search requests. Please slow down." } },
});

export const viewRateLimit = rateLimit({
  windowMs: 60_000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: { code: "RATE_LIMITED", message: "Too many requests. Please slow down." } },
});

export const commentRateLimit = rateLimit({
  windowMs: 60_000,
  max: 12,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: { code: "RATE_LIMITED", message: "Too many comments. Please slow down." } },
});

/**
 * Drafts previously ran on the general 300/min limit, which was fine when an
 * autosave payload was at most a few hundred bytes. A note body is now up to
 * 20,000 characters and every save also writes a DraftVersion snapshot, so
 * the cost per request is orders of magnitude higher. 60/min is one save per
 * second — far above the 1200ms debounce any real editor session produces,
 * and low enough that a scripted client cannot flood the version history.
 */
export const draftWriteRateLimit = rateLimit({
  windowMs: 60_000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: { code: "RATE_LIMITED", message: "Saving too quickly. Give it a moment." } },
});

export const generalRateLimit = rateLimit({
  windowMs: 60_000,
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: { code: "RATE_LIMITED", message: "Too many requests. Please slow down." } },
});
