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

/**
 * Fields shared by the Keeper profile and every pen name. Birth date and
 * gender are optional and, critically, do not become public just because they
 * were filled in — each is gated behind its own show* flag, which defaults to
 * false. Filling a field in is not the same as publishing it.
 */
const profileFieldsSchema = z.object({
  bio: z.string().trim().max(LIMITS.BIO_MAX_BYTES).optional().default(""),
  avatarUrl: z.string().trim().url().max(2048).optional().nullable(),
  links: z.array(z.string().trim().url().max(2048)).max(5).optional().default([]),
  location: z.string().trim().max(LIMITS.LOCATION_MAX_LENGTH).optional().nullable(),
  pronouns: z.string().trim().max(LIMITS.PRONOUNS_MAX_LENGTH).optional().nullable(),
  birthDate: z.coerce.date().optional().nullable(),
  showBirthDate: z.boolean().optional().default(false),
  gender: z.string().trim().max(LIMITS.GENDER_MAX_LENGTH).optional().nullable(),
  showGender: z.boolean().optional().default(false),
  isVisible: z.boolean().optional().default(true),
});

export const createIdentitySchema = profileFieldsSchema.extend({
  // A pen name is the only kind anyone creates through this route — the
  // REAL_NAME Keeper profile is created once, at registration. Kept as an
  // enum rather than dropped so an older client sending "PSEUDONYM"
  // explicitly still validates.
  type: z.enum([IdentityType.REAL_NAME, IdentityType.PSEUDONYM]).optional().default(IdentityType.PSEUDONYM),
  username: usernameSchema,
  displayName: z.string().trim().min(1).max(LIMITS.DISPLAY_NAME_MAX_LENGTH),
});
export type CreateIdentityInput = z.infer<typeof createIdentitySchema>;

/**
 * `type` and `username` stay out of the update shape: both are effectively
 * permanent once a byline has been shown to readers. The one exception is a
 * generated Keeper handle, which gets a single rename through its own route.
 */
export const updateIdentitySchema = profileFieldsSchema
  .extend({ displayName: z.string().trim().min(1).max(LIMITS.DISPLAY_NAME_MAX_LENGTH) })
  .partial();
export type UpdateIdentityInput = z.infer<typeof updateIdentitySchema>;

/** The one free rename owed to a Keeper whose handle was generated for them. */
export const changeUsernameSchema = z.object({ username: usernameSchema });
export type ChangeUsernameInput = z.infer<typeof changeUsernameSchema>;
