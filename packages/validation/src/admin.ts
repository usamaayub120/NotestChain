import { z } from "zod";
import { AccountStatus, Role, StaffRole } from "@noteschain/shared";

export const updateUserStatusSchema = z.object({
  status: z.enum([AccountStatus.ACTIVE, AccountStatus.SUSPENDED, AccountStatus.DELETED]),
  reason: z.string().trim().min(1).max(500),
});
export type UpdateUserStatusInput = z.infer<typeof updateUserStatusSchema>;

export const updateUserRoleSchema = z.object({
  role: z.enum([Role.USER, Role.MODERATOR, Role.ADMIN]),
});
export type UpdateUserRoleInput = z.infer<typeof updateUserRoleSchema>;

export const assignStaffRolesSchema = z.object({
  roles: z.array(z.enum([
    StaffRole.MODERATOR,
    StaffRole.CAMPAIGN_CREATOR,
    StaffRole.CAMPAIGN_APPROVER,
    StaffRole.PLATFORM_ADMIN,
    StaffRole.ACCESS_MANAGER,
  ])).min(1).max(4),
});
export type AssignStaffRolesInput = z.infer<typeof assignStaffRolesSchema>;

export const createStaffInvitationSchema = z.object({
  email: z.string().trim().email().max(320),
  roles: z.array(z.enum([
    StaffRole.MODERATOR,
    StaffRole.CAMPAIGN_CREATOR,
    StaffRole.CAMPAIGN_APPROVER,
    StaffRole.PLATFORM_ADMIN,
  ])).min(1).max(4),
});
export type CreateStaffInvitationInput = z.infer<typeof createStaffInvitationSchema>;

export const acceptStaffInvitationSchema = z.object({ token: z.string().min(32).max(256) });
export type AcceptStaffInvitationInput = z.infer<typeof acceptStaffInvitationSchema>;

export const delistPublicationSchema = z.object({
  reason: z.string().trim().min(1).max(500),
});
export type DelistPublicationInput = z.infer<typeof delistPublicationSchema>;
