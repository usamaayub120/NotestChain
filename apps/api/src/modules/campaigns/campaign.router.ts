import { Router } from "express";
import { Permission } from "@noteschain/shared";
import { createCampaignSchema } from "@noteschain/validation";
import { asyncHandler, ok, requireParam } from "../../lib/http.js";
import { requireAuth, requirePermission } from "../../middleware/auth.js";
import { approveCampaign, changeCampaignStatus, createCampaign, listCampaigns, previewCampaign, submitCampaign } from "./campaign.service.js";

export const campaignRouter = Router();
campaignRouter.use(requireAuth);
campaignRouter.get("/", requirePermission(Permission.CREATE_CAMPAIGN), asyncHandler(async (_req, res) => ok(res, await listCampaigns())));
campaignRouter.post("/preview", requirePermission(Permission.CREATE_CAMPAIGN), asyncHandler(async (req, res) => ok(res, await previewCampaign(req.auth!.roles, createCampaignSchema.pick({ audience: true }).parse(req.body)))));
campaignRouter.post("/", requirePermission(Permission.CREATE_CAMPAIGN), asyncHandler(async (req, res) => ok(res, await createCampaign(req.auth!.userId, req.auth!.roles, createCampaignSchema.parse(req.body), req.ip), 201)));
campaignRouter.post("/:id/submit", requirePermission(Permission.CREATE_CAMPAIGN), asyncHandler(async (req, res) => { await submitCampaign(req.auth!.userId, req.auth!.roles, requireParam(req, "id"), req.ip); return ok(res, { submitted: true }); }));
campaignRouter.post("/:id/approve", requirePermission(Permission.APPROVE_CAMPAIGN), asyncHandler(async (req, res) => { await approveCampaign(req.auth!.userId, req.auth!.roles, requireParam(req, "id"), req.ip); return ok(res, { approved: true }); }));
campaignRouter.post("/:id/pause", asyncHandler(async (req, res) => { await changeCampaignStatus(req.auth!.userId, req.auth!.roles, requireParam(req, "id"), "PAUSED", req.ip); return ok(res, { paused: true }); }));
campaignRouter.post("/:id/cancel", asyncHandler(async (req, res) => { await changeCampaignStatus(req.auth!.userId, req.auth!.roles, requireParam(req, "id"), "CANCELLED", req.ip); return ok(res, { cancelled: true }); }));
