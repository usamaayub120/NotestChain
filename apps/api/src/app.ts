import express from "express";
import helmet from "helmet";
import cors from "cors";
import cookieParser from "cookie-parser";
import compression from "compression";
import { pinoHttp } from "pino-http";
import { env } from "./config/env.js";
import { logger } from "./lib/logger.js";
import { requestContext } from "./middleware/requestContext.js";
import { attachAuth } from "./middleware/auth.js";
import { csrfProtection } from "./middleware/csrf.js";
import { idempotencyProtection } from "./middleware/idempotency.js";
import { generalRateLimit } from "./middleware/rateLimit.js";
import { notFoundHandler, errorHandler } from "./middleware/errorHandler.js";
import { healthRouter } from "./modules/health/health.router.js";
import { authRouter } from "./modules/auth/auth.router.js";
import { identitiesRouter } from "./modules/identities/identities.router.js";
import { draftsRouter } from "./modules/drafts/drafts.router.js";
import { moderationRouter } from "./modules/moderation/moderation.router.js";
import { publicationsRouter } from "./modules/publications/publications.router.js";
import { profilesRouter } from "./modules/profiles/profiles.router.js";
import { tagsRouter } from "./modules/tags/tags.router.js";
import { searchRouter } from "./modules/search/search.router.js";
import { bookmarkCollectionsRouter, bookmarksRouter } from "./modules/bookmarks/bookmarks.router.js";
import { commentsRouter } from "./modules/comments/comments.router.js";
import { followsRouter } from "./modules/follows/follows.router.js";
import { translationsRouter } from "./modules/translations/translations.router.js";
import { pushRouter } from "./modules/push/push.router.js";
import { adminRouter } from "./modules/admin/admin.router.js";
import { staffAccessRouter } from "./modules/admin/staffAccess.router.js";
import { campaignRouter } from "./modules/campaigns/campaign.router.js";
import { seoRouter } from "./modules/seo/seo.router.js";
import { appVersionRouter } from "./modules/app-version/app-version.router.js";
import { releasePolicyRouter } from "./modules/release-policy/release-policy.router.js";

export function createApp() {
  const app = express();

  app.disable("x-powered-by");
  // React Native's HTTP stack can expose a body-less 304 response instead of
  // transparently serving its cached JSON body. API consumers need a usable
  // response every time, so disable Express's automatic ETag/304 handling.
  // Static web assets keep their own immutable cache policy in Nginx.
  app.set("etag", false);
  app.set("trust proxy", 1); // behind Nginx — needed for correct req.ip / secure cookies

  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          // Statically allowlisted, not conditioned on whether GA4 is
          // currently configured in SiteSettings — harmless either way,
          // since gtag.js is only ever requested when an admin sets a
          // Measurement ID (apps/api/src/modules/seo/seo.service.ts).
          // Covers the SEO-router-rendered pages and /api/*; the plain
          // static app routes (dashboard, login, ...) have no CSP today
          // either way, unchanged by this.
          scriptSrc: ["'self'", "https://www.googletagmanager.com"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          imgSrc: ["'self'", "data:", "https:"],
          connectSrc: ["'self'", "https://www.google-analytics.com", "https://*.google-analytics.com", "https://*.analytics.google.com"],
          objectSrc: ["'none'"],
          frameAncestors: ["'none'"],
          baseUri: ["'self'"],
        },
      },
      crossOriginResourcePolicy: { policy: "same-site" },
    }),
  );
  app.use(cors({ origin: env.CORS_ORIGIN, credentials: true }));
  app.use(compression());
  app.use(express.json({ limit: "256kb" }));
  app.use(cookieParser());
  app.use(requestContext);
  app.use(
    pinoHttp({
      logger,
      genReqId: (req) => (req as express.Request).id,
      customLogLevel: (_req, res) => (res.statusCode >= 500 ? "error" : res.statusCode >= 400 ? "warn" : "info"),
    }),
  );
  app.use(generalRateLimit);
  app.use(attachAuth);
  app.use(idempotencyProtection);
  app.use(csrfProtection);

  // Public, crawlable/shareable HTML routes — server-rendered <head> tags
  // for search/social crawlers (apps/api/src/modules/seo). Nginx proxies
  // exactly these paths here instead of serving the static SPA shell
  // directly; every other route (dashboard, login, admin, ...) is
  // untouched. Mounted before the JSON API routes below since it owns a
  // disjoint set of paths (no /api prefix) and is unaffected by their order.
  app.use(seoRouter);

  app.get("/health", (_req, res) => res.status(200).json({ status: "ok" }));
  app.use("/api/v1", healthRouter);
  app.use("/api/v1/app", appVersionRouter);
  app.use("/api/v1/internal/release-policy", releasePolicyRouter);
  app.use("/api/v1/auth", authRouter);
  app.use("/api/v1/identities", identitiesRouter);
  // A route-scoped body limit rather than raising the global one: a 20,000
  // character note is at most ~80KB of UTF-8, but JSON string escaping can
  // inflate worst-case input several times over. Only drafts need the extra
  // headroom, so only drafts get it — every other endpoint stays at 256kb.
  app.use("/api/v1/drafts", express.json({ limit: "1mb" }), draftsRouter);
  app.use("/api/v1/moderation", moderationRouter);
  app.use("/api/v1/publications", publicationsRouter);
  app.use("/api/v1/profiles", profilesRouter);
  app.use("/api/v1/tags", tagsRouter);
  app.use("/api/v1/search", searchRouter);
  app.use("/api/v1/bookmarks", bookmarksRouter);
  app.use("/api/v1/bookmark-collections", bookmarkCollectionsRouter);
  app.use("/api/v1/comments", commentsRouter);
  app.use("/api/v1/follows", followsRouter);
  app.use("/api/v1/translate", translationsRouter);
  app.use("/api/v1/push", pushRouter);
  app.use("/api/v1/campaigns", campaignRouter);
  app.use("/api/v1/admin", staffAccessRouter);
  app.use("/api/v1/admin", adminRouter);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
