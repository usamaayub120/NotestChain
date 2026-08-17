import type { PasswordResetRequestedData } from "../schemas.js";
import { paragraph, renderLayout, renderPlainText, type RenderedEmail } from "../layout.js";

export function renderPasswordResetRequested(data: PasswordResetRequestedData): RenderedEmail {
  const heading = "Reset your password";
  const action = { label: "Set a new password", href: data.resetUrl };

  return {
    subject: heading,
    html: renderLayout({
      preheader: `This link expires in ${data.expiryMinutes} minutes.`,
      heading,
      bodyHtml: [
        paragraph("Someone asked to reset the password on this account. If that was you, set a new one below."),
        paragraph(
          `This link expires in ${data.expiryMinutes} minutes. If you didn’t request this, ignore this email — nothing will change.`,
        ),
      ].join(""),
      action,
    }),
    text: renderPlainText({
      heading,
      lines: [
        "Someone asked to reset the password on this account. If that was you, set a new one below.",
        `This link expires in ${data.expiryMinutes} minutes. If you didn't request this, ignore this email — nothing will change.`,
      ],
      action,
    }),
  };
}
