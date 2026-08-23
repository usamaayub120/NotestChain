import { Router, type Request, type Response } from "express";
import { logger } from "../../lib/logger.js";
import { requireParam } from "../../lib/http.js";
import { getSiteSettings } from "../admin/settings.service.js";
import { getPublicationById } from "../publications/publications.service.js";
import { getProfile } from "../profiles/profiles.service.js";
import { getRawShell, renderShell } from "./htmlTemplate.js";
import {
  buildExploreHead,
  buildHomeHead,
  buildHowItWorksHead,
  buildProfileHead,
  buildPublicationHead,
  buildTagHead,
} from "./seo.service.js";
import { buildRobotsTxt } from "./robots.service.js";
import { buildSitemapXml } from "./sitemap.service.js";

export const seoRouter = Router();

/**
 * Wraps a per-route head-tag builder: on any failure (bad id, DB hiccup)
 * falls back to the unmodified default shell rather than a 500 — worst
 * case a page loses its per-route SEO tags, it never breaks a page load.
 */
function seoHandler(build: (req: Request) => Promise<string>) {
  return async (req: Request, res: Response) => {
    let headHtml: string | undefined;
    try {
      headHtml = await build(req);
    } catch (err) {
      logger.warn({ err, path: req.path }, "SEO: failed to build head tags — serving default shell");
    }
    const html = headHtml !== undefined ? renderShell(headHtml) : getRawShell();
    if (!html) {
      res.status(404).end();
      return;
    }
    res.type("html").send(html);
  };
}

seoRouter.get(
  "/",
  seoHandler(async () => buildHomeHead(await getSiteSettings())),
);

seoRouter.get(
  "/explore",
  seoHandler(async () => buildExploreHead(await getSiteSettings())),
);

seoRouter.get(
  "/how-it-works",
  seoHandler(async () => buildHowItWorksHead(await getSiteSettings())),
);

seoRouter.get(
  "/tags/:tag",
  seoHandler(async (req) => buildTagHead(requireParam(req, "tag"), await getSiteSettings())),
);

seoRouter.get(
  "/p/:id",
  seoHandler(async (req) => {
    const [publication, settings] = await Promise.all([getPublicationById(requireParam(req, "id")), getSiteSettings()]);
    return buildPublicationHead(publication, settings);
  }),
);

// The literal "@" is part of the route pattern (unlike the web app's React
// Router v6 route, which can't mix a static prefix into a param segment —
// see ProfileHandleRoute.tsx) — req.params.handle is already just the
// username, no leading "@" to strip.
seoRouter.get(
  "/@:handle",
  seoHandler(async (req) => {
    const [profile, settings] = await Promise.all([getProfile(requireParam(req, "handle")), getSiteSettings()]);
    return buildProfileHead(profile, settings);
  }),
);

seoRouter.get("/robots.txt", async (_req, res) => {
  const body = await buildRobotsTxt();
  res.type("text/plain").send(body);
});

seoRouter.get("/sitemap.xml", async (_req, res) => {
  const body = await buildSitemapXml();
  res.type("application/xml").send(body);
});
