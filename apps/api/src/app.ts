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
import { adminRouter } from "./modules/admin/admin.router.js";

export function createApp() {
  const app = express();

  app.disable("x-powered-by");
  app.set("trust proxy", 1); // behind Nginx — needed for correct req.ip / secure cookies

  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          imgSrc: ["'self'", "data:", "https:"],
          connectSrc: ["'self'"],
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
  app.use(csrfProtection);

  app.get("/health", (_req, res) => res.status(200).json({ status: "ok" }));
  app.use("/api/v1", healthRouter);
  app.use("/api/v1/auth", authRouter);
  app.use("/api/v1/identities", identitiesRouter);
  app.use("/api/v1/drafts", draftsRouter);
  app.use("/api/v1/moderation", moderationRouter);
  app.use("/api/v1/publications", publicationsRouter);
  app.use("/api/v1/profiles", profilesRouter);
  app.use("/api/v1/tags", tagsRouter);
  app.use("/api/v1/search", searchRouter);
  app.use("/api/v1/bookmarks", bookmarksRouter);
  app.use("/api/v1/bookmark-collections", bookmarkCollectionsRouter);
  app.use("/api/v1/admin", adminRouter);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
