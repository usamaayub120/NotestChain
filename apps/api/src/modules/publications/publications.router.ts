import { Router } from "express";
import { randomBytes } from "node:crypto";
import { z } from "zod";
import {
  createCommentSchema,
  createReportSchema,
  recordPublicationViewSchema,
  updateCommentsEnabledSchema,
} from "@noteschain/validation";
import { asyncHandler, paginated, ok, requireParam } from "../../lib/http.js";
import { Errors } from "../../lib/apiError.js";
import { requireAuth } from "../../middleware/auth.js";
import { MOBILE_VISITOR_HEADER_NAME, VISITOR_COOKIE_NAME } from "../../config/security.js";
import { setVisitorCookie } from "../auth/cookies.js";
import { commentRateLimit, viewRateLimit } from "../../middleware/rateLimit.js";
import {
  getPublicationById,
  getPublicationRevisions,
  listMyPublicationAnalytics,
  listPublicPublications,
} from "./publications.service.js";
import { verifyPublication } from "./verify.service.js";
import { createReport } from "./reports.service.js";
import { hashVisitorToken, recordView } from "./views.service.js";
import { createComment, listTopLevelComments, setCommentsEnabled } from "../comments/comments.service.js";

export const publicationsRouter = Router();

function parseReferrerHost(referer: string | undefined): string | undefined {
  if (!referer) return undefined;
  try {
    return new URL(referer).hostname;
  } catch {
    return undefined;
  }
}

const listQuerySchema = z.object({
  page: z.coerce.number().int().min(1).max(1000).optional().default(1),
  pageSize: z.coerce.number().int().min(1).max(50).optional().default(20),
  tag: z.string().trim().toLowerCase().max(24).optional(),
});

const myAnalyticsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).max(1000).optional().default(1),
  pageSize: z.coerce.number().int().min(1).max(100).optional().default(25),
});

publicationsRouter.get(
  "/mine/analytics",
  requireAuth,
  asyncHandler(async (req, res) => {
    const query = myAnalyticsQuerySchema.parse(req.query);
    const { items, total } = await listMyPublicationAnalytics(req.auth!.userId, query);
    return paginated(res, items, { ...query, total });
  }),
);

publicationsRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    const query = listQuerySchema.parse(req.query);
    const { items, total } = await listPublicPublications(query);
    return paginated(res, items, { page: query.page, pageSize: query.pageSize, total });
  }),
);

publicationsRouter.get(
  "/:id",
  asyncHandler(async (req, res) => {
    const publication = await getPublicationById(requireParam(req, "id"), req.auth?.userId);
    return ok(res, publication);
  }),
);

publicationsRouter.get(
  "/:id/revisions",
  asyncHandler(async (req, res) => {
    const revisions = await getPublicationRevisions(requireParam(req, "id"));
    return ok(res, revisions);
  }),
);

publicationsRouter.get(
  "/:id/verify",
  asyncHandler(async (req, res) => {
    const result = await verifyPublication(requireParam(req, "id"));
    return ok(res, result);
  }),
);

publicationsRouter.post(
  "/:id/view",
  viewRateLimit,
  asyncHandler(async (req, res) => {
    const input = recordPublicationViewSchema.parse(req.body);
    const referrerHost = parseReferrerHost(req.get("referer"));
    const mobileVisitorToken = req.auth?.transport === "MOBILE" ? req.get(MOBILE_VISITOR_HEADER_NAME) : undefined;
    if (mobileVisitorToken && !/^[A-Za-z0-9_-]{32,128}$/.test(mobileVisitorToken)) {
      throw Errors.badRequest("Invalid mobile visitor token.");
    }
    let visitorToken = mobileVisitorToken ?? (req.cookies?.[VISITOR_COOKIE_NAME] as string | undefined);
    if (!visitorToken) {
      visitorToken = randomBytes(32).toString("base64url");
      if (req.auth?.transport !== "MOBILE") setVisitorCookie(res, visitorToken);
    }
    const result = await recordView(
      requireParam(req, "id"),
      input,
      hashVisitorToken(visitorToken),
      req.auth?.userId,
      referrerHost,
    );
    return ok(res, result, 202);
  }),
);

publicationsRouter.post(
  "/:id/report",
  requireAuth,
  asyncHandler(async (req, res) => {
    const input = createReportSchema.parse(req.body);
    const report = await createReport(requireParam(req, "id"), req.auth!.userId, input.reason);
    return ok(res, { id: report.id, status: report.status }, 201);
  }),
);

publicationsRouter.get(
  "/:id/comments",
  asyncHandler(async (req, res) => {
    const query = listQuerySchema.parse(req.query);
    const { items, total } = await listTopLevelComments(
      requireParam(req, "id"),
      query.page,
      query.pageSize,
      req.auth?.userId,
    );
    return paginated(res, items, { page: query.page, pageSize: query.pageSize, total });
  }),
);

publicationsRouter.post(
  "/:id/comments",
  requireAuth,
  commentRateLimit,
  asyncHandler(async (req, res) => {
    const input = createCommentSchema.parse(req.body);
    const comment = await createComment(requireParam(req, "id"), req.auth!.userId, input);
    return ok(res, comment, 201);
  }),
);

publicationsRouter.patch(
  "/:id/comments-enabled",
  requireAuth,
  asyncHandler(async (req, res) => {
    const input = updateCommentsEnabledSchema.parse(req.body);
    const publication = await setCommentsEnabled(requireParam(req, "id"), req.auth!.userId, input.commentsEnabled);
    return ok(res, { commentsEnabled: publication.commentsEnabled });
  }),
);
