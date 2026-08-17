import type { PublicationApprovedData } from "../schemas.js";
import { paragraph, renderLayout, renderPlainText, type RenderedEmail } from "../layout.js";
import { escapeHtml } from "../escape.js";

export function renderPublicationApproved(data: PublicationApprovedData): RenderedEmail {
  const heading = "Your note was approved";
  const action = { label: "Review and publish", href: data.draftEditUrl };
  const title = escapeHtml(data.publicationTitle);

  return {
    subject: heading,
    html: renderLayout({
      preheader: "One step left before it's kept for good.",
      heading,
      bodyHtml: [
        paragraph(
          `A moderator approved “${title}.” It isn’t public yet — approval means it’s ready for the last step, which is yours to take.`,
        ),
        paragraph(
          "Publishing is permanent. Once it’s kept, it can’t be edited or taken back, so it’s worth reading over once more before you do.",
        ),
      ].join(""),
      action,
    }),
    text: renderPlainText({
      heading,
      lines: [
        `A moderator approved “${data.publicationTitle}.” It isn’t public yet — approval means it’s ready for the last step, which is yours to take.`,
        "Publishing is permanent. Once it’s kept, it can’t be edited or taken back, so it’s worth reading over once more before you do.",
      ],
      action,
    }),
  };
}
