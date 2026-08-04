import { Router } from "express";
import { z } from "zod";
import { createReportSchema } from "@noteschain/validation";
import { asyncHandler, paginated, ok, requireParam } from "../../lib/http.js";
import { requireAuth } from "../../middleware/auth.js";
import { getPublicationById, getPublicationRevisions, listPublicPublications } from "./publications.service.js";
import { verifyPublication } from "./verify.service.js";
import { createReport } from "./reports.service.js";

export const publicationsRouter = Router();

const listQuerySchema = z.object({
  page: z.coerce.number().int().min(1).max(1000).optional().default(1),
  pageSize: z.coerce.number().int().min(1).max(50).optional().default(20),
  tag: z.string().trim().toLowerCase().max(24).optional(),
});

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
    const publication = await getPublicationById(requireParam(req, "id"));
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
  "/:id/report",
  requireAuth,
  asyncHandler(async (req, res) => {
    const input = createReportSchema.parse(req.body);
    const report = await createReport(requireParam(req, "id"), req.auth!.userId, input.reason);
    return ok(res, { id: report.id, status: report.status }, 201);
  }),
);
