import type { StaffInvitationData } from "../schemas.js";
import { paragraph, renderLayout, renderPlainText, type RenderedEmail } from "../layout.js";

export function renderStaffInvitation(data: StaffInvitationData): RenderedEmail {
  const heading = "You have been invited to help manage NotesChain";
  const action = { label: "Review invitation", href: data.acceptUrl };
  return {
    subject: heading,
    html: renderLayout({
      preheader: "Review and accept your staff invitation.",
      heading,
      bodyHtml: paragraph(`Use the secure link below to sign in or create your own account. This invitation expires in ${data.expiryDays} days.`),
      action,
    }),
    text: renderPlainText({ heading, lines: [`Use the secure link below to sign in or create your own account. This invitation expires in ${data.expiryDays} days.`], action }),
  };
}
