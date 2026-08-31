import { Router } from "express";
import { acceptStaffInvitationSchema, assignStaffRolesSchema, createStaffInvitationSchema } from "@noteschain/validation";
import { Permission } from "@noteschain/shared";
import { asyncHandler, ok, requireParam } from "../../lib/http.js";
import { requireAuth, requirePermission } from "../../middleware/auth.js";
import { prisma } from "../../lib/prisma.js";
import { acceptStaffInvitation, createStaffInvitation, listStaffAccess, revokeStaffInvitation, setStaffRoles } from "./staffAccess.service.js";

export const staffAccessRouter = Router();
staffAccessRouter.use(requireAuth);

staffAccessRouter.get("/access", requirePermission(Permission.MANAGE_STAFF_ACCESS), asyncHandler(async (_req, res) => ok(res, await listStaffAccess())));
staffAccessRouter.post("/access/invitations", requirePermission(Permission.MANAGE_STAFF_ACCESS), asyncHandler(async (req, res) => ok(res, await createStaffInvitation(req.auth!.userId, req.auth!.roles, createStaffInvitationSchema.parse(req.body), req.ip), 201)));
staffAccessRouter.post("/access/invitations/:id/revoke", requirePermission(Permission.MANAGE_STAFF_ACCESS), asyncHandler(async (req, res) => { await revokeStaffInvitation(req.auth!.userId, req.auth!.roles, requireParam(req, "id"), req.ip); return ok(res, { revoked: true }); }));
staffAccessRouter.patch("/access/staff/:id/roles", requirePermission(Permission.MANAGE_STAFF_ACCESS), asyncHandler(async (req, res) => { await setStaffRoles(req.auth!.userId, req.auth!.roles, requireParam(req, "id"), assignStaffRolesSchema.parse(req.body), req.ip); return ok(res, { updated: true }); }));

/** Existing users accept after normal registration/sign-in; no admin ever sees a password. */
staffAccessRouter.post("/access/invitations/accept", asyncHandler(async (req, res) => {
  const user = await prisma.user.findUniqueOrThrow({ where: { id: req.auth!.userId }, select: { email: true } });
  await acceptStaffInvitation(req.auth!.userId, user.email, acceptStaffInvitationSchema.parse(req.body).token, req.ip);
  return ok(res, { accepted: true });
}));
