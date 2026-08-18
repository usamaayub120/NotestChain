import { Router } from "express";
import { z } from "zod";
import { ModerationAction, Role } from "@noteschain/shared";
import { moderationDecisionSchema } from "@noteschain/validation";
import { asyncHandler, ok, paginated, requireParam } from "../../lib/http.js";
import { requireAuth, requireRole } from "../../middleware/auth.js";
import { decideSubmission, getSubmissionDetail, listPendingSubmissions } from "./moderation.service.js";

export const moderationRouter = Router();
moderationRouter.use(requireAuth, requireRole(Role.MODERATOR));

const submissionsQuerySchema = z
  .object({
    page: z.coerce.number().int().min(1).max(1000).optional().default(1),
    pageSize: z.coerce.number().int().min(1).max(100).optional().default(25),
    from: z.coerce.date().optional(),
    to: z.coerce.date().optional(),
  })
  .refine((query) => !query.from || !query.to || query.from <= query.to, {
    message: "From date must be before the To date.",
    path: ["to"],
  });

moderationRouter.get(
  "/submissions",
  asyncHandler(async (req, res) => {
    const query = submissionsQuerySchema.parse(req.query);
    const { items, total } = await listPendingSubmissions(query);
    return paginated(res, items, { page: query.page, pageSize: query.pageSize, total });
  }),
);

moderationRouter.get(
  "/submissions/:id",
  asyncHandler(async (req, res) => {
    const detail = await getSubmissionDetail(requireParam(req, "id"));
    return ok(res, detail);
  }),
);

function decisionHandler(action: (typeof ModerationAction)[keyof typeof ModerationAction]) {
  return asyncHandler(async (req, res) => {
    const input = moderationDecisionSchema.parse(req.body);
    const result = await decideSubmission(req.auth!.userId, requireParam(req, "id"), action, input, req.ip);
    return ok(res, result);
  });
}

moderationRouter.post("/submissions/:id/approve", decisionHandler(ModerationAction.APPROVE));
moderationRouter.post("/submissions/:id/reject", decisionHandler(ModerationAction.REJECT));
moderationRouter.post("/submissions/:id/request-changes", decisionHandler(ModerationAction.REQUEST_CHANGES));
