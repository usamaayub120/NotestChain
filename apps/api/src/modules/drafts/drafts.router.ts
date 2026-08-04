import { Router } from "express";
import {
  autosaveSchema,
  createDraftSchema,
  restoreVersionSchema,
  submitDraftSchema,
  updateDraftSchema,
} from "@noteschain/validation";
import { asyncHandler, ok, requireParam } from "../../lib/http.js";
import { requireAuth } from "../../middleware/auth.js";
import {
  autosaveDraft,
  confirmPublish,
  createDraft,
  deleteDraft,
  getDraft,
  listDraftVersions,
  listDraftsForUser,
  restoreDraftVersion,
  submitDraft,
  toDraftDTO,
  updateDraft,
  withdrawDraft,
} from "./drafts.service.js";

export const draftsRouter = Router();
draftsRouter.use(requireAuth);

draftsRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    const drafts = await listDraftsForUser(req.auth!.userId);
    return ok(res, drafts.map(toDraftDTO));
  }),
);

draftsRouter.post(
  "/",
  asyncHandler(async (req, res) => {
    const input = createDraftSchema.parse(req.body ?? {});
    const draft = await createDraft(req.auth!.userId, input);
    return ok(res, toDraftDTO(draft), 201);
  }),
);

draftsRouter.get(
  "/:id",
  asyncHandler(async (req, res) => {
    const draft = await getDraft(req.auth!.userId, requireParam(req, "id"));
    return ok(res, toDraftDTO(draft));
  }),
);

draftsRouter.patch(
  "/:id",
  asyncHandler(async (req, res) => {
    const input = updateDraftSchema.parse(req.body);
    const draft = await updateDraft(req.auth!.userId, requireParam(req, "id"), input);
    return ok(res, toDraftDTO(draft));
  }),
);

draftsRouter.delete(
  "/:id",
  asyncHandler(async (req, res) => {
    await deleteDraft(req.auth!.userId, requireParam(req, "id"));
    return ok(res, { success: true });
  }),
);

draftsRouter.post(
  "/:id/autosave",
  asyncHandler(async (req, res) => {
    const input = autosaveSchema.parse(req.body);
    const draft = await autosaveDraft(req.auth!.userId, requireParam(req, "id"), input);
    return ok(res, toDraftDTO(draft));
  }),
);

draftsRouter.get(
  "/:id/versions",
  asyncHandler(async (req, res) => {
    const versions = await listDraftVersions(req.auth!.userId, requireParam(req, "id"));
    return ok(res, versions);
  }),
);

draftsRouter.post(
  "/:id/versions/:versionId/restore",
  asyncHandler(async (req, res) => {
    restoreVersionSchema.parse({ versionId: requireParam(req, "versionId") });
    const draft = await restoreDraftVersion(req.auth!.userId, requireParam(req, "id"), requireParam(req, "versionId"));
    return ok(res, toDraftDTO(draft));
  }),
);

draftsRouter.post(
  "/:id/submit",
  asyncHandler(async (req, res) => {
    const { draft } = await submitDraft(req.auth!.userId, requireParam(req, "id"));
    return ok(res, toDraftDTO(draft));
  }),
);

draftsRouter.post(
  "/:id/confirm-publish",
  asyncHandler(async (req, res) => {
    submitDraftSchema.parse(req.body);
    const publication = await confirmPublish(req.auth!.userId, requireParam(req, "id"));
    return ok(res, publication, 201);
  }),
);

draftsRouter.post(
  "/:id/withdraw",
  asyncHandler(async (req, res) => {
    const draft = await withdrawDraft(req.auth!.userId, requireParam(req, "id"));
    return ok(res, toDraftDTO(draft));
  }),
);
