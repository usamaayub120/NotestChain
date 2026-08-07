import { Router } from "express";
import { z } from "zod";
import { Role } from "@noteschain/shared";
import { delistPublicationSchema, resolveCommentReportSchema, resolveReportSchema } from "@noteschain/validation";
import { asyncHandler, ok, paginated, requireParam } from "../../lib/http.js";
import { requireAuth, requireRole } from "../../middleware/auth.js";
import {
  delistPublication,
  getViewBreakdown,
  listAuditLog,
  listBlockchainJobs,
  listCommentReports,
  listMostViewedPublications,
  listReports,
  resolveCommentReport,
  resolveReport,
  restorePublicationListing,
  retryBlockchainJob,
} from "./admin.service.js";

export const adminRouter = Router();
adminRouter.use(requireAuth, requireRole(Role.ADMIN));

const paginationQuerySchema = z.object({
  page: z.coerce.number().int().min(1).max(1000).optional().default(1),
  pageSize: z.coerce.number().int().min(1).max(100).optional().default(20),
});

adminRouter.post(
  "/publications/:id/delist",
  asyncHandler(async (req, res) => {
    const input = delistPublicationSchema.parse(req.body);
    const publication = await delistPublication(req.auth!.userId, requireParam(req, "id"), input, req.ip);
    return ok(res, publication);
  }),
);

adminRouter.post(
  "/publications/:id/restore-listing",
  asyncHandler(async (req, res) => {
    const publication = await restorePublicationListing(req.auth!.userId, requireParam(req, "id"), req.ip);
    return ok(res, publication);
  }),
);

const reportsQuerySchema = z.object({
  status: z.enum(["OPEN", "RESOLVED"]).optional(),
});

adminRouter.get(
  "/reports",
  asyncHandler(async (req, res) => {
    const query = reportsQuerySchema.parse(req.query);
    const reports = await listReports(query.status);
    return ok(res, reports);
  }),
);

adminRouter.post(
  "/reports/:id/resolve",
  asyncHandler(async (req, res) => {
    const input = resolveReportSchema.parse(req.body);
    const report = await resolveReport(req.auth!.userId, requireParam(req, "id"), input, req.ip);
    return ok(res, report);
  }),
);

const viewsQuerySchema = z.object({
  days: z.coerce.number().int().min(1).max(365).optional().default(30),
});

adminRouter.get(
  "/views",
  asyncHandler(async (req, res) => {
    const query = viewsQuerySchema.parse(req.query);
    const [breakdown, mostViewed] = await Promise.all([
      getViewBreakdown(query.days),
      listMostViewedPublications(query.days),
    ]);
    return ok(res, { ...breakdown, mostViewed });
  }),
);

adminRouter.get(
  "/comment-reports",
  asyncHandler(async (req, res) => {
    const query = reportsQuerySchema.parse(req.query);
    const reports = await listCommentReports(query.status);
    return ok(res, reports);
  }),
);

adminRouter.post(
  "/comment-reports/:id/resolve",
  asyncHandler(async (req, res) => {
    const input = resolveCommentReportSchema.parse(req.body);
    const report = await resolveCommentReport(req.auth!.userId, requireParam(req, "id"), input, req.ip);
    return ok(res, report);
  }),
);

const auditLogQuerySchema = paginationQuerySchema.extend({
  action: z.string().trim().max(100).optional(),
  targetType: z.string().trim().max(100).optional(),
});

adminRouter.get(
  "/audit-log",
  asyncHandler(async (req, res) => {
    const query = auditLogQuerySchema.parse(req.query);
    const { items, total } = await listAuditLog(query);
    return paginated(res, items, { page: query.page, pageSize: query.pageSize, total });
  }),
);

const blockchainJobsQuerySchema = paginationQuerySchema.extend({
  status: z.enum(["PENDING", "PROCESSING", "PROCESSED", "FAILED"]).optional(),
});

adminRouter.get(
  "/blockchain/jobs",
  asyncHandler(async (req, res) => {
    const query = blockchainJobsQuerySchema.parse(req.query);
    const { items, total } = await listBlockchainJobs(query);
    return paginated(res, items, { page: query.page, pageSize: query.pageSize, total });
  }),
);

adminRouter.post(
  "/blockchain/jobs/:id/retry",
  asyncHandler(async (req, res) => {
    const job = await retryBlockchainJob(req.auth!.userId, requireParam(req, "id"), req.ip);
    return ok(res, job);
  }),
);
