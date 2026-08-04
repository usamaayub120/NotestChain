import { Router } from "express";
import { createIdentitySchema, updateIdentitySchema } from "@noteschain/validation";
import { asyncHandler, ok, requireParam } from "../../lib/http.js";
import { requireAuth } from "../../middleware/auth.js";
import {
  createIdentity,
  deleteIdentity,
  getIdentity,
  listIdentitiesForUser,
  toIdentityDTO,
  updateIdentity,
} from "./identities.service.js";

export const identitiesRouter = Router();
identitiesRouter.use(requireAuth);

identitiesRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    const identities = await listIdentitiesForUser(req.auth!.userId);
    return ok(res, identities.map(toIdentityDTO));
  }),
);

identitiesRouter.post(
  "/",
  asyncHandler(async (req, res) => {
    const input = createIdentitySchema.parse(req.body);
    const identity = await createIdentity(req.auth!.userId, input);
    return ok(res, toIdentityDTO(identity), 201);
  }),
);

identitiesRouter.get(
  "/:id",
  asyncHandler(async (req, res) => {
    const identity = await getIdentity(req.auth!.userId, requireParam(req, "id"));
    return ok(res, toIdentityDTO(identity));
  }),
);

identitiesRouter.patch(
  "/:id",
  asyncHandler(async (req, res) => {
    const input = updateIdentitySchema.parse(req.body);
    const identity = await updateIdentity(req.auth!.userId, requireParam(req, "id"), input);
    return ok(res, toIdentityDTO(identity));
  }),
);

identitiesRouter.delete(
  "/:id",
  asyncHandler(async (req, res) => {
    const identity = await deleteIdentity(req.auth!.userId, requireParam(req, "id"));
    return ok(res, identity ? toIdentityDTO(identity) : { deleted: true });
  }),
);
