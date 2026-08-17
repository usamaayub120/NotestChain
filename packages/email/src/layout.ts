import { EMAIL_COLORS, EMAIL_FONTS } from "./colors.js";
import { escapeHtml } from "./escape.js";

export interface RenderedEmail {
  subject: string;
  html: string;
  text: string;
}

export interface EmailAction {
  label: string;
  href: string;
  /**
   * "button" is the ember primary CTA. "link" is a plain text link — used
   * once, for PUBLICATION_REJECTED, where a bright orange button reads as
   * the wrong emotional register right after telling someone no.
   */
  variant?: "button" | "link";
}

/** A paragraph of already-HTML-safe content (built via the helpers below, or plain escaped text). */
export function paragraph(html: string): string {
  return `<p style="margin:0 0 16px;font-family:${EMAIL_FONTS.body};font-size:16px;line-height:1.6;color:${EMAIL_COLORS.foreground};">${html}</p>`;
}

/** Quoted, indented text — for a moderator's reason or a comment body. Escapes its input. */
export function blockquote(text: string): string {
  return `<blockquote style="margin:0 0 16px;padding:12px 16px;border-left:3px solid ${EMAIL_COLORS.border};background-color:${EMAIL_COLORS.muted};border-radius:0 8px 8px 0;font-family:${EMAIL_FONTS.body};font-size:15px;line-height:1.55;color:${EMAIL_COLORS.foreground};">${escapeHtml(text)}</blockquote>`;
}

/**
 * A single label/value technical detail — the address a publication lives
 * at, an explorer link. Monospace, matching the app's own rule that mono
 * type is reserved for signatures/PDAs/hashes and never for prose
 * (DESIGN_SYSTEM.md §4). Escapes its input.
 */
export function technicalDetail(label: string, value: string): string {
  return `<div style="margin:0 0 12px;">
    <div style="font-family:${EMAIL_FONTS.body};font-size:12px;color:${EMAIL_COLORS.mutedForeground};margin:0 0 4px;">${escapeHtml(label)}</div>
    <div style="font-family:${EMAIL_FONTS.mono};font-size:13px;color:${EMAIL_COLORS.foreground};word-break:break-all;background-color:${EMAIL_COLORS.muted};border-radius:6px;padding:8px 10px;">${escapeHtml(value)}</div>
  </div>`;
}

/** A plain-text version of the same value/label pair, for the text alternative. */
export function technicalDetailText(label: string, value: string): string {
  return `${label}: ${value}`;
}

function actionHtml(action: EmailAction): string {
  const label = escapeHtml(action.label);
  const href = escapeHtml(action.href);
  if (action.variant === "link") {
    return `<p style="margin:8px 0 0;"><a href="${href}" style="font-family:${EMAIL_FONTS.body};font-size:15px;font-weight:600;color:${EMAIL_COLORS.primary};text-decoration:underline;">${label}</a></p>`;
  }
  return `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:8px 0 0;"><tr><td style="border-radius:8px;background-color:${EMAIL_COLORS.primary};">
    <a href="${href}" style="display:inline-block;padding:12px 24px;font-family:${EMAIL_FONTS.body};font-size:15px;font-weight:600;color:${EMAIL_COLORS.primaryForeground};text-decoration:none;border-radius:8px;">${label}</a>
  </td></tr></table>`;
}

/**
 * The shared shell every template renders into: a single centred card on a
 * paper-toned background, the wordmark, a heading, the template's own body
 * content, an optional action, and a quiet footer. No table-based hackery
 * beyond what Outlook actually requires (a `role="presentation"` table for
 * centring) — this isn't a marketing template that needs pixel parity
 * across thirty clients, just something that reads cleanly everywhere.
 */
export function renderLayout(options: {
  preheader: string;
  heading: string;
  bodyHtml: string;
  action?: EmailAction;
}): string {
  const { preheader, heading, bodyHtml, action } = options;

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="color-scheme" content="light" />
    <title>${escapeHtml(heading)}</title>
  </head>
  <body style="margin:0;padding:0;background-color:${EMAIL_COLORS.background};">
    <div style="display:none;max-height:0;overflow:hidden;opacity:0;">${escapeHtml(preheader)}</div>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:${EMAIL_COLORS.background};">
      <tr>
        <td align="center" style="padding:32px 16px;">
          <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background-color:${EMAIL_COLORS.surface};border:1px solid ${EMAIL_COLORS.border};border-radius:16px;">
            <tr>
              <td style="padding:28px 32px 4px;">
                <span style="font-family:${EMAIL_FONTS.body};font-weight:700;font-size:18px;letter-spacing:-0.01em;color:${EMAIL_COLORS.foreground};">NotesChain</span>
              </td>
            </tr>
            <tr>
              <td style="padding:20px 32px 4px;">
                <h1 style="margin:0 0 16px;font-family:${EMAIL_FONTS.body};font-size:21px;line-height:1.35;font-weight:600;color:${EMAIL_COLORS.foreground};">${escapeHtml(heading)}</h1>
                ${bodyHtml}
                ${action ? actionHtml(action) : ""}
              </td>
            </tr>
            <tr>
              <td style="padding:28px 32px 28px;border-top:1px solid ${EMAIL_COLORS.border};margin-top:8px;">
                <p style="margin:20px 0 0;font-family:${EMAIL_FONTS.body};font-size:13px;color:${EMAIL_COLORS.mutedForeground};">Thoughts worth keeping.</p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

/** Assembles the plaintext alternative from the same pieces every template already has. */
export function renderPlainText(options: { heading: string; lines: string[]; action?: EmailAction }): string {
  const { heading, lines, action } = options;
  const parts = [heading, "", ...lines];
  if (action) parts.push("", `${action.label}: ${action.href}`);
  parts.push("", "Thoughts worth keeping.");
  return parts.join("\n");
}
