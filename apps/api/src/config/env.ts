import { z } from "zod";
import { emailEnvShape, isSmtpConfigured } from "@noteschain/email";

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  APP_VERSION: z.string().default("0.0.0"),
  PORT: z.coerce.number().int().positive().default(3001),
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),

  SESSION_SECRET: z
    .string()
    .min(32, "SESSION_SECRET must be at least 32 characters")
    .default("dev-only-insecure-secret-do-not-use-in-production-000000"),
  COOKIE_DOMAIN: z.string().optional(),
  COOKIE_SECURE: z
    .string()
    .optional()
    .transform((v) => v === "true"),
  CORS_ORIGIN: z.string().default("http://localhost:5173"),

  AUTH_RATE_LIMIT_MAX: z.coerce.number().int().positive().default(10),
  AUTH_RATE_LIMIT_WINDOW_MS: z.coerce.number().int().positive().default(900_000),

  SOLANA_CLUSTER: z.string().default("devnet"),
  SOLANA_RPC_HTTP_URL: z.string().url().default("https://api.devnet.solana.com"),
  SOLANA_RPC_WS_URL: z.string().default("wss://api.devnet.solana.com"),
  SOLANA_PROGRAM_ID: z.string().default("exQDCAihgmrV4FNPpuQXrFXp2pvKUumntCfantzc5GX"),
  SOLANA_COMMITMENT: z.enum(["processed", "confirmed", "finalized"]).default("confirmed"),
  PUBLIC_EXPLORER_BASE_URL: z.string().url().default("https://explorer.solana.com"),

  LOG_LEVEL: z.enum(["fatal", "error", "warn", "info", "debug", "trace"]).default("info"),

  // Optional everywhere, including production — verifyCaptcha() bypasses
  // the check when unset and logs a warning each time. Deliberately not a
  // hard production requirement like SESSION_SECRET: unlike that secret,
  // this one depends on a Cloudflare Turnstile site being set up first,
  // which is a separate, later step — crashing startup without it would
  // block deploying the feature before that's done.
  TURNSTILE_SECRET_KEY: z.string().optional(),

  ...emailEnvShape,
});

export type Env = z.infer<typeof envSchema>;

function loadEnv(): Env {
  const parsed = envSchema.safeParse(process.env);
  if (!parsed.success) {
    console.error("Invalid environment configuration:", parsed.error.flatten().fieldErrors);
    process.exit(1);
  }
  if (parsed.data.NODE_ENV === "production" && !process.env.SESSION_SECRET) {
    console.error("SESSION_SECRET must be set explicitly in production.");
    process.exit(1);
  }
  if (parsed.data.NODE_ENV === "production" && !process.env.TURNSTILE_SECRET_KEY) {
    console.warn("TURNSTILE_SECRET_KEY not set — captcha verification is bypassed until a Cloudflare Turnstile secret is configured.");
  }
  // Soft-warn, not hard-fail: the API only ever enqueues an EmailJob row, it
  // never opens an SMTP connection itself. Without SMTP configured, jobs
  // simply queue up as PENDING until the worker can send them — a visible,
  // recoverable state, not a broken request. The worker enforces this
  // strictly at its own startup, since it's the process that actually needs
  // working credentials.
  if (parsed.data.NODE_ENV === "production" && !isSmtpConfigured(parsed.data)) {
    console.warn("SMTP is not fully configured — emails will queue but the worker won't be able to send them yet.");
  }
  return parsed.data;
}

export const env = loadEnv();
