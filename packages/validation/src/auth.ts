import { z } from "zod";
import { LIMITS } from "@noteschain/shared";
import { usernameSchema } from "./identities.js";

// Deliberately permissive on password composition (length is what matters
// most for entropy) but requires a minimum that Argon2id + rate limiting
// can reasonably defend.
export const registerSchema = z.object({
  email: z.string().trim().toLowerCase().email().max(254),
  password: z.string().min(10).max(256),
  captchaToken: z.string().min(1),
  acceptedTerms: z.literal(true, {
    errorMap: () => ({ message: "You must accept the Terms of Service and Privacy Policy." }),
  }),
  // Every account gets a Keeper profile at registration. These stay optional
  // on the wire so an already-installed mobile binary, which does not send
  // them, keeps registering successfully — the server generates a handle from
  // the email in that case and the owner renames it once. Tighten to required
  // only after old clients have aged out.
  username: usernameSchema.optional(),
  displayName: z.string().trim().min(1).max(LIMITS.DISPLAY_NAME_MAX_LENGTH).optional(),
});
export type RegisterInput = z.infer<typeof registerSchema>;

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email().max(254),
  password: z.string().min(1).max(256),
});
export type LoginInput = z.infer<typeof loginSchema>;

export const forgotPasswordSchema = z.object({
  email: z.string().trim().toLowerCase().email().max(254),
});
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;

export const resetPasswordSchema = z.object({
  token: z.string().min(1),
  // Same rule as registerSchema's password — length is what matters most.
  password: z.string().min(10).max(256),
});
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;

export const deleteAccountSchema = z.object({
  password: z.string().min(1),
});
export type DeleteAccountInput = z.infer<typeof deleteAccountSchema>;
