import { Router } from "express";
import { z } from "zod";
import { createReportSchema } from "@noteschain/validation";
import { asyncHandler, ok, paginated, requireParam } from "../../lib/http.js";
import { requireAuth } from "../../middleware/auth.js";
import { deleteComment, createCommentReport, listReplies } from "./comments.service.js";

export const commentsRouter = Router();

const listQuerySchema = z.object({
  page: z.coerce.number().int().min(1).max(1000).optional().default(1),
  pageSize: z.coerce.number().int().min(1).max(50).optional().default(20),
});

commentsRouter.get(
  "/:id/replies",
  asyncHandler(async (req, res) => {
    const query = listQuerySchema.parse(req.query);
    const { items, total } = await listReplies(requireParam(req, "id"), query.page, query.pageSize, req.auth?.userId);
    return paginated(res, items, { page: query.page, pageSize: query.pageSize, total });
  }),
);

commentsRouter.delete(
  "/:id",
  requireAuth,
  asyncHandler(async (req, res) => {
    await deleteComment(requireParam(req, "id"), req.auth!.userId);
    return ok(res, { deleted: true });
  }),
);

commentsRouter.post(
  "/:id/report",
  requireAuth,
  asyncHandler(async (req, res) => {
    const input = createReportSchema.parse(req.body);
    const report = await createCommentReport(requireParam(req, "id"), req.auth!.userId, input.reason);
    return ok(res, { id: report.id, status: report.status }, 201);
  }),
);
