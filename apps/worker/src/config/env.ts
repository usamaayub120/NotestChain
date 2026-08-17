import { z } from "zod";
import { emailEnvShape, isSmtpConfigured } from "@noteschain/email";

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),

  SOLANA_CLUSTER: z.string().default("devnet"),
  SOLANA_RPC_HTTP_URL: z.string().url().default("https://api.devnet.solana.com"),
  SOLANA_RPC_WS_URL: z.string().default("wss://api.devnet.solana.com"),
  SOLANA_PROGRAM_ID: z.string().default("exQDCAihgmrV4FNPpuQXrFXp2pvKUumntCfantzc5GX"),
  SOLANA_COMMITMENT: z.enum(["processed", "confirmed", "finalized"]).default("confirmed"),

  SOLANA_PUBLISHER_KEYPAIR_PATH: z.string().optional(),
  SOLANA_PUBLISHER_KEYPAIR_JSON: z.string().optional(),

  // Also read by the API for building the same links, but only the worker
  // actually fetches from it (constructing the explorer URL for the
  // chain-finalized email at the point the worker itself finalizes a
  // publication).
  PUBLIC_EXPLORER_BASE_URL: z.string().url().default("https://explorer.solana.com"),

  WORKER_POLL_INTERVAL_MS: z.coerce.number().int().positive().default(4000),
  WORKER_MAX_ATTEMPTS: z.coerce.number().int().positive().default(8),
  WORKER_RECONCILE_INTERVAL_MS: z.coerce.number().int().positive().default(300_000),

  LOG_LEVEL: z.enum(["fatal", "error", "warn", "info", "debug", "trace"]).default("info"),

  ...emailEnvShape,
});

export type WorkerEnv = z.infer<typeof envSchema>;

function loadEnv(): WorkerEnv {
  const parsed = envSchema.safeParse(process.env);
  if (!parsed.success) {
    console.error("Invalid worker environment configuration:", parsed.error.flatten().fieldErrors);
    process.exit(1);
  }

  // The worker is the process that actually opens an SMTP connection —
  // unlike the API, which only ever enqueues a row, this one can't degrade
  // gracefully. Failing fast at startup beats discovering it only once the
  // first EmailJob comes up for send and every attempt quietly retries into
  // a wall.
  if (parsed.data.NODE_ENV === "production" && !isSmtpConfigured(parsed.data)) {
    console.error(
      "SMTP_HOST, SMTP_USER, SMTP_PASSWORD, and EMAIL_FROM_ADDRESS must all be set explicitly in production.",
    );
    process.exit(1);
  }

  return parsed.data;
}

export const env = loadEnv();
