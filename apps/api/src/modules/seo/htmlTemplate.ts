import { readFileSync } from "node:fs";
import { join } from "node:path";
import { env } from "../../config/env.js";
import { logger } from "../../lib/logger.js";

const SEO_START = "<!-- SEO:START -->";
const SEO_END = "<!-- SEO:END -->";

let template: string | null | undefined; // undefined = not yet attempted, null = attempted and missing

/**
 * Reads apps/web/index.html once (from WEB_DIST_DIR, the same directory
 * Nginx serves as its web root) and caches it for the process lifetime — a
 * fresh deploy means a fresh container/process, so there's nothing to
 * invalidate. Returns null if the file isn't there (e.g. running the API
 * standalone in dev without a web build); callers degrade to a plain 404
 * rather than crash the request.
 */
function loadTemplate(): string | null {
  if (template !== undefined) return template;
  try {
    template = readFileSync(join(env.WEB_DIST_DIR, "index.html"), "utf-8");
  } catch (err) {
    logger.warn({ err, dir: env.WEB_DIST_DIR }, "SEO: web index.html not found — SSR meta injection disabled.");
    template = null;
  }
  return template;
}

/** The unmodified template, for callers falling back after a render failure. */
export function getRawShell(): string | null {
  return loadTemplate();
}

/**
 * Swaps the block between the SEO:START/SEO:END markers in index.html
 * (see apps/web/index.html) for route-specific <head> tags, leaving the
 * script tag that boots the SPA untouched — a normal browser hydrates
 * exactly as it does with the static file.
 */
export function renderShell(headHtml: string): string | null {
  const html = loadTemplate();
  if (!html) return null;
  const start = html.indexOf(SEO_START);
  const end = html.indexOf(SEO_END);
  if (start === -1 || end === -1 || end < start) {
    logger.warn("SEO: index.html is missing its SEO:START/SEO:END markers — serving it unmodified.");
    return html;
  }
  return html.slice(0, start) + headHtml + html.slice(end + SEO_END.length);
}
