import { z } from "zod";
import { AccountStatus, Role } from "@noteschain/shared";

export const updateUserStatusSchema = z.object({
  status: z.enum([AccountStatus.ACTIVE, AccountStatus.SUSPENDED, AccountStatus.DELETED]),
  reason: z.string().trim().min(1).max(500),
});
export type UpdateUserStatusInput = z.infer<typeof updateUserStatusSchema>;

export const updateUserRoleSchema = z.object({
  role: z.enum([Role.USER, Role.MODERATOR, Role.ADMIN]),
});
export type UpdateUserRoleInput = z.infer<typeof updateUserRoleSchema>;

export const delistPublicationSchema = z.object({
  reason: z.string().trim().min(1).max(500),
});
export type DelistPublicationInput = z.infer<typeof delistPublicationSchema>;
