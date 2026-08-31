import { randomBytes } from "node:crypto";
import type { StaffRole as PrismaStaffRole } from "@prisma/client";
import { EmailKind, buildEmailJobData } from "@noteschain/email";
import { Permission, StaffRole, hasPermission, type StaffRole as StaffRoleType } from "@noteschain/shared";
import type { AssignStaffRolesInput, CreateStaffInvitationInput } from "@noteschain/validation";
import { env } from "../../config/env.js";
import { Errors } from "../../lib/apiError.js";
import { recordAudit } from "../../lib/audit.js";
import { prisma } from "../../lib/prisma.js";
import { revokeAllSessionsForUser } from "../auth/session.service.js";
import { hashToken } from "../auth/session.service.js";

const INVITATION_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const ASSIGNABLE_BY_ACCESS_MANAGER: StaffRoleType[] = [
  StaffRole.MODERATOR,
  StaffRole.CAMPAIGN_CREATOR,
  StaffRole.CAMPAIGN_APPROVER,
  StaffRole.PLATFORM_ADMIN,
];

function isOwner(roles: readonly string[]) { return hasPermission(roles, Permission.MANAGE_ACCESS_MANAGERS); }
function assertCanEdit(actorId: string, actorRoles: readonly string[], targetId: string, targetRoles: readonly string[]) {
  if (actorId === targetId) throw Errors.forbidden("You cannot change your own staff access.");
  if (targetRoles.includes(StaffRole.OWNER)) throw Errors.forbidden("Owner access is managed outside the web interface.");
  if (!isOwner(actorRoles) && targetRoles.includes(StaffRole.ACCESS_MANAGER)) throw Errors.forbidden("Only an Owner can change an Access Manager.");
}

function assertAssignable(actorRoles: readonly string[], roles: readonly string[]) {
  const allowed = isOwner(actorRoles) ? [...ASSIGNABLE_BY_ACCESS_MANAGER, StaffRole.ACCESS_MANAGER] : ASSIGNABLE_BY_ACCESS_MANAGER;
  if (roles.some((role) => !allowed.includes(role as StaffRoleType))) throw Errors.forbidden("You cannot grant one or more requested roles.");
}

export async function listStaffAccess() {
  const [staff, invitations] = await Promise.all([
    prisma.user.findMany({
      where: { staffRoles: { some: {} } },
      orderBy: { createdAt: "asc" },
      select: {
        id: true, email: true, status: true, createdAt: true, lastLoginAt: true,
        staffRoles: { select: { role: true }, orderBy: { role: "asc" } },
      },
    }),
    prisma.staffInvitation.findMany({
      where: { status: "PENDING" }, orderBy: { createdAt: "desc" }, take: 100,
      select: { id: true, email: true, roles: true, status: true, expiresAt: true, createdAt: true, invitedBy: { select: { email: true } } },
    }),
  ]);
  return {
    staff: staff.map(({ staffRoles, ...user }) => ({ ...user, roles: staffRoles.map((assignment) => assignment.role) })),
    invitations,
  };
}

export async function setStaffRoles(actorId: string, actorRoles: readonly string[], targetId: string, input: AssignStaffRolesInput, ipAddress?: string) {
  const target = await prisma.user.findUnique({ where: { id: targetId }, include: { staffRoles: { select: { role: true } } } });
  if (!target) throw Errors.notFound("User not found.");
  assertCanEdit(actorId, actorRoles, targetId, target.staffRoles.map((assignment) => assignment.role));
  assertAssignable(actorRoles, input.roles);

  const roles = Array.from(new Set(input.roles)) as PrismaStaffRole[];
  await prisma.$transaction(async (tx) => {
    await tx.staffRoleAssignment.deleteMany({ where: { userId: targetId, role: { not: "OWNER" } } });
    await tx.staffRoleAssignment.createMany({ data: roles.map((role) => ({ userId: targetId, role })), skipDuplicates: true });
  });
  await revokeAllSessionsForUser(targetId);
  await recordAudit({ actorUserId: actorId, action: "STAFF_ROLES_UPDATED", targetType: "User", targetId, metadata: { roles }, ipAddress });
}

export async function createStaffInvitation(actorId: string, actorRoles: readonly string[], input: CreateStaffInvitationInput, ipAddress?: string) {
  assertAssignable(actorRoles, input.roles);
  const email = input.email.toLowerCase();
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + INVITATION_TTL_MS);
  const invitation = await prisma.$transaction(async (tx) => {
    await tx.staffInvitation.updateMany({ where: { email, status: "PENDING" }, data: { status: "REVOKED", revokedAt: new Date() } });
    return tx.staffInvitation.create({ data: { email, tokenHash: hashToken(token), roles: input.roles as PrismaStaffRole[], invitedById: actorId, expiresAt } });
  });
  const acceptUrl = `${env.PUBLIC_WEB_ORIGIN}/access/invitation?token=${encodeURIComponent(token)}`;
  await prisma.emailJob.create({
    data: {
      kind: EmailKind.STAFF_INVITATION,
      toEmail: email,
      data: buildEmailJobData(EmailKind.STAFF_INVITATION, { acceptUrl, expiryDays: 7 }) as never,
    },
  });
  await recordAudit({ actorUserId: actorId, action: "STAFF_INVITATION_CREATED", targetType: "StaffInvitation", targetId: invitation.id, metadata: { roles: input.roles }, ipAddress });
  return { id: invitation.id, expiresAt };
}

export async function revokeStaffInvitation(actorId: string, actorRoles: readonly string[], invitationId: string, ipAddress?: string) {
  if (!hasPermission(actorRoles, Permission.MANAGE_STAFF_ACCESS)) throw Errors.forbidden();
  const invitation = await prisma.staffInvitation.findUnique({ where: { id: invitationId } });
  if (!invitation) throw Errors.notFound("Invitation not found.");
  if (invitation.status !== "PENDING") throw Errors.conflict("This invitation is no longer pending.");
  await prisma.staffInvitation.update({ where: { id: invitationId }, data: { status: "REVOKED", revokedAt: new Date() } });
  await recordAudit({ actorUserId: actorId, action: "STAFF_INVITATION_REVOKED", targetType: "StaffInvitation", targetId: invitationId, ipAddress });
}

export async function acceptStaffInvitation(userId: string, email: string, token: string, ipAddress?: string) {
  const invitation = await prisma.staffInvitation.findUnique({ where: { tokenHash: hashToken(token) } });
  if (!invitation || invitation.status !== "PENDING" || invitation.expiresAt <= new Date()) throw Errors.badRequest("This staff invitation is invalid or expired.");
  if (invitation.email !== email.toLowerCase()) throw Errors.forbidden("Sign in with the email address that received this invitation.");
  await prisma.$transaction(async (tx) => {
    await tx.staffRoleAssignment.createMany({ data: invitation.roles.map((role) => ({ userId, role })), skipDuplicates: true });
    await tx.staffInvitation.update({ where: { id: invitation.id }, data: { status: "ACCEPTED", acceptedById: userId, acceptedAt: new Date() } });
  });
  await revokeAllSessionsForUser(userId);
  await recordAudit({ actorUserId: userId, action: "STAFF_INVITATION_ACCEPTED", targetType: "StaffInvitation", targetId: invitation.id, ipAddress });
}
