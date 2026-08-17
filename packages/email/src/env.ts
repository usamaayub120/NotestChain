import { z } from "zod";

/**
 * The SMTP/sender config shape, shared between apps/api and apps/worker so
 * a new var is added once and both processes agree on its meaning. Each app
 * still owns its own `envSchema` and its own production hard-fail/soft-warn
 * rules (see apps/worker/src/config/env.ts) — only the API sends nothing
 * over SMTP directly, it just enqueues EmailJob rows, so it can start
 * without SMTP configured; the worker is the one that actually needs
 * working credentials, and it enforces that itself.
 *
 * SMTP_SECURE is parsed as an explicit string comparison, not
 * `z.coerce.boolean()` — coercion just calls `Boolean(value)`, under which
 * the string "false" is truthy. Matches COOKIE_SECURE's existing pattern in
 * apps/api/src/config/env.ts.
 */
export const emailEnvShape = {
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.coerce.number().int().positive().default(587),
  SMTP_SECURE: z
    .string()
    .optional()
    .transform((v) => v === "true"),
  SMTP_USER: z.string().optional(),
  SMTP_PASSWORD: z.string().optional(),
  EMAIL_FROM_ADDRESS: z.string().email().optional(),
  EMAIL_FROM_NAME: z.string().default("NotesChain"),
  // Used to build links back into the web app from inside an email (a
  // draft's edit page, a reset-password link, a note's public reader page).
  PUBLIC_WEB_ORIGIN: z.string().url().default("http://localhost:5173"),
};

export type EmailEnv = {
  SMTP_HOST?: string;
  SMTP_PORT: number;
  SMTP_SECURE: boolean;
  SMTP_USER?: string;
  SMTP_PASSWORD?: string;
  EMAIL_FROM_ADDRESS?: string;
  EMAIL_FROM_NAME: string;
  PUBLIC_WEB_ORIGIN: string;
};

/** True once enough is configured to actually attempt a send. */
export function isSmtpConfigured(env: EmailEnv): boolean {
  return Boolean(env.SMTP_HOST && env.SMTP_USER && env.SMTP_PASSWORD && env.EMAIL_FROM_ADDRESS);
}
