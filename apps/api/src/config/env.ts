import { z } from "zod";
import { emailEnvShape, isSmtpConfigured } from "@noteschain/email";
import { pushEnvShape } from "@noteschain/push";

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  APP_VERSION: z.string().default("0.0.0"),
  // Optional shared secret for the GitHub release workflow. The endpoint is
  // deliberately disabled when this is absent, so a deployment can safely
  // land before the owner provisions the matching GitHub repository secret.
  RELEASE_POLICY_WEBHOOK_SECRET: z.string().min(32).optional(),
  PORT: z.coerce.number().int().positive().default(3001),
  AZURE_TRANSLATOR_KEY: z.string().optional().transform((value) => value?.trim() || undefined),
  AZURE_TRANSLATOR_REGION: z.string().optional().transform((value) => value?.trim() || undefined),
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

  // The last step of removing anonymous posting (both notes and comments).
  // Both clients stop offering it well before this flips, but an older installed mobile
  // binary can still submit it, so the server keeps accepting it until
  // adoption is high enough. Flipping this to "false" closes the door via a
  // container env change and a restart, with no image rebuild and no
  // rollback needed to reverse it. Already-published anonymous notes and
  // comments are unaffected either way: they are immutable and stay
  // anonymous forever.
  ALLOW_ANONYMOUS_POSTING: z
    .string()
    .optional()
    .transform((v) => v !== "false"),

  AUTH_RATE_LIMIT_MAX: z.coerce.number().int().positive().default(10),
  AUTH_RATE_LIMIT_WINDOW_MS: z.coerce.number().int().positive().default(900_000),

  SOLANA_CLUSTER: z.string().default("devnet"),
  SOLANA_RPC_HTTP_URL: z.string().url().default("https://api.devnet.solana.com"),
  SOLANA_RPC_WS_URL: z.string().default("wss://api.devnet.solana.com"),
  SOLANA_PROGRAM_ID: z.string().default("exQDCAihgmrV4FNPpuQXrFXp2pvKUumntCfantzc5GX"),
  SOLANA_COMMITMENT: z.enum(["processed", "confirmed", "finalized"]).default("confirmed"),
  PUBLIC_EXPLORER_BASE_URL: z.string().url().default("https://explorer.solana.com"),

  // Public keys only — never secrets. The API must never load either
  // keypair's secret half (see getReadOnlySolanaClient's throwaway wallet
  // above); these exist purely so the admin wallet-balances page can show
  // *which* accounts matter and query their balances via a plain
  // getBalance(pubkey) read. SOLANA_PUBLISHER_PUBLIC_KEY has no default
  // since it's deployment-specific and only derivable from the real
  // keypair; SOLANA_UPGRADE_AUTHORITY_PUBLIC_KEY defaults to this
  // deployment's known value.
  SOLANA_PUBLISHER_PUBLIC_KEY: z.string().optional(),
  SOLANA_UPGRADE_AUTHORITY_PUBLIC_KEY: z.string().default("BCYqFNE6WQQM6pq8td6qwNxu8N1k39amAbfiuaiHmvmH"),
  SOLANA_PUBLISHER_LOW_BALANCE_SOL: z.coerce.number().positive().default(0.05),
  SOLANA_UPGRADE_AUTHORITY_LOW_BALANCE_SOL: z.coerce.number().positive().default(1),

  LOG_LEVEL: z.enum(["fatal", "error", "warn", "info", "debug", "trace"]).default("info"),

  // Where the SEO layer (apps/api/src/modules/seo) reads the built web
  // index.html from, to inject per-route <head> tags before Nginx would
  // otherwise serve it verbatim — see infra/nginx/nginx.conf's proxy_pass
  // blocks for /, /p/, /@, /tags/, /explore, /how-it-works, /robots.txt and
  // /sitemap.xml. Matches Nginx's own `root` in the Docker runtime image
  // (both processes run in the same container); override for local dev
  // after running `pnpm --filter @noteschain/web build`.
  WEB_DIST_DIR: z.string().default("/usr/share/nginx/html"),

  // Optional everywhere, including production — verifyCaptcha() bypasses
  // the check when unset and logs a warning each time. Deliberately not a
  // hard production requirement like SESSION_SECRET: unlike that secret,
  // this one depends on a Cloudflare Turnstile site being set up first,
  // which is a separate, later step — crashing startup without it would
  // block deploying the feature before that's done.
  TURNSTILE_SECRET_KEY: z.string().optional(),

  ...emailEnvShape,
  ...pushEnvShape,
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
