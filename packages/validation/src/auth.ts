import { z } from "zod";

// Deliberately permissive on password composition (length is what matters
// most for entropy) but requires a minimum that Argon2id + rate limiting
// can reasonably defend.
export const registerSchema = z.object({
  email: z.string().trim().toLowerCase().email().max(254),
  password: z.string().min(10).max(256),
});
export type RegisterInput = z.infer<typeof registerSchema>;

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email().max(254),
  password: z.string().min(1).max(256),
});
export type LoginInput = z.infer<typeof loginSchema>;
