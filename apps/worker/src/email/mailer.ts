import { createRequire } from "node:module";
import type { Transporter } from "nodemailer";
import { isSmtpConfigured } from "@noteschain/email";
import { env } from "../config/env.js";

// nodemailer is CJS — createRequire sidesteps ESM default-import interop
// entirely, the same reason @coral-xyz/anchor is loaded this way elsewhere
// in this codebase (see packages/blockchain-client/src/program.ts): `node`
// and `tsx`'s esbuild-based loader don't always agree on how a CJS default
// export surfaces through a plain `import`.
const require = createRequire(import.meta.url);
const nodemailer = require("nodemailer") as typeof import("nodemailer");

let cachedTransporter: Transporter | null = null;

function getTransporter(): Transporter {
  if (!isSmtpConfigured(env)) {
    throw new Error("SMTP is not configured (SMTP_HOST/SMTP_USER/SMTP_PASSWORD/EMAIL_FROM_ADDRESS).");
  }
  if (!cachedTransporter) {
    cachedTransporter = nodemailer.createTransport({
      host: env.SMTP_HOST,
      port: env.SMTP_PORT,
      secure: env.SMTP_SECURE,
      auth: { user: env.SMTP_USER, pass: env.SMTP_PASSWORD },
    });
  }
  return cachedTransporter;
}

export interface OutgoingEmail {
  to: string;
  subject: string;
  html: string;
  text: string;
}

export async function sendMail(message: OutgoingEmail): Promise<void> {
  const transporter = getTransporter();
  await transporter.sendMail({
    from: `"${env.EMAIL_FROM_NAME}" <${env.EMAIL_FROM_ADDRESS}>`,
    to: message.to,
    subject: message.subject,
    html: message.html,
    text: message.text,
  });
}
