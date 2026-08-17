import type { PublicationChangesRequestedData } from "../schemas.js";
import { blockquote, paragraph, renderLayout, renderPlainText, type RenderedEmail } from "../layout.js";
import { escapeHtml } from "../escape.js";

export function renderPublicationChangesRequested(data: PublicationChangesRequestedData): RenderedEmail {
  const heading = "Changes requested on your note";
  const title = escapeHtml(data.publicationTitle);
  const action = { label: "Edit draft", href: data.draftEditUrl };

  return {
    subject: heading,
    html: renderLayout({
      preheader: "A small change before this can move forward.",
      heading,
      bodyHtml: [
        paragraph(`A moderator reviewed “${title}” and asked for a change before it can move forward:`),
        blockquote(data.reason),
        paragraph("Edit the draft whenever you’re ready, then resubmit it."),
      ].join(""),
      action,
    }),
    text: renderPlainText({
      heading,
      lines: [
        `A moderator reviewed "${data.publicationTitle}" and asked for a change before it can move forward:`,
        `"${data.reason}"`,
        "Edit the draft whenever you're ready, then resubmit it.",
      ],
      action,
    }),
  };
}
