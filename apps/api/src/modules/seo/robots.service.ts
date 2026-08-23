import { env } from "../../config/env.js";
import { getSiteSettings } from "../admin/settings.service.js";

// Mirrors the disallow list the previous static apps/web/public/robots.txt
// shipped (now superseded by this dynamic route so indexingEnabled and the
// Sitemap: line can react to admin settings without a redeploy). /search is
// new here — a query-driven listing of the same notes already covered by
// /p/:id and /tags/:tag, not worth indexing on its own.
const DISALLOWED_PATHS = ["/admin/", "/dashboard", "/drafts", "/identities", "/bookmarks", "/settings", "/search"];

// General search indexing (Googlebot, Bingbot, etc.) is intentionally left
// untouched — only bulk AI-training/scraping crawlers are blocked.
const AI_CRAWLER_USER_AGENTS = [
  "GPTBot",
  "CCBot",
  "anthropic-ai",
  "ClaudeBot",
  "Google-Extended",
  "Bytespider",
  "PerplexityBot",
  "Amazonbot",
];

export async function buildRobotsTxt(): Promise<string> {
  const settings = await getSiteSettings();
  const origin = env.PUBLIC_WEB_ORIGIN.replace(/\/$/, "");

  if (!settings.indexingEnabled) {
    // The admin's staging/preview toggle — nothing on this deployment
    // should be indexed, so skip straight past the usual allowances.
    return ["User-agent: *", "Disallow: /", "", `Sitemap: ${origin}/sitemap.xml`].join("\n");
  }

  const lines = ["User-agent: *", "Allow: /", ...DISALLOWED_PATHS.map((path) => `Disallow: ${path}`), ""];
  for (const agent of AI_CRAWLER_USER_AGENTS) {
    lines.push(`User-agent: ${agent}`, "Disallow: /", "");
  }
  lines.push(`Sitemap: ${origin}/sitemap.xml`);
  return lines.join("\n");
}
