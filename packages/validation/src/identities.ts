import { z } from "zod";
import { IdentityType, LIMITS } from "@noteschain/shared";

const usernamePattern = /^[a-z0-9][a-z0-9_-]*$/;

export const usernameSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(LIMITS.USERNAME_MIN_LENGTH)
  .max(LIMITS.USERNAME_MAX_LENGTH)
  .regex(usernamePattern, "Use lowercase letters, numbers, - or _ only");

export const createIdentitySchema = z.object({
  type: z.enum([IdentityType.REAL_NAME, IdentityType.PSEUDONYM]),
  username: usernameSchema,
  displayName: z.string().trim().min(1).max(LIMITS.DISPLAY_NAME_MAX_LENGTH),
  bio: z.string().trim().max(LIMITS.BIO_MAX_BYTES).optional().default(""),
  avatarUrl: z.string().trim().url().max(2048).optional().nullable(),
  links: z.array(z.string().trim().url().max(2048)).max(5).optional().default([]),
  isVisible: z.boolean().optional().default(true),
});
export type CreateIdentityInput = z.infer<typeof createIdentitySchema>;

export const updateIdentitySchema = createIdentitySchema
  .omit({ type: true, username: true })
  .partial();
export type UpdateIdentityInput = z.infer<typeof updateIdentitySchema>;
