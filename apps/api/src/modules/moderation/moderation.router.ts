import { Router } from "express";
import { ModerationAction, Role } from "@noteschain/shared";
import { moderationDecisionSchema } from "@noteschain/validation";
import { asyncHandler, ok, requireParam } from "../../lib/http.js";
import { requireAuth, requireRole } from "../../middleware/auth.js";
import { decideSubmission, getSubmissionDetail, listPendingSubmissions } from "./moderation.service.js";

export const moderationRouter = Router();
moderationRouter.use(requireAuth, requireRole(Role.MODERATOR));

moderationRouter.get(
  "/submissions",
  asyncHandler(async (_req, res) => {
    const submissions = await listPendingSubmissions();
    return ok(res, submissions);
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
