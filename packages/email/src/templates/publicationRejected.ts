import type { PublicationRejectedData } from "../schemas.js";
import { blockquote, paragraph, renderLayout, renderPlainText, type RenderedEmail } from "../layout.js";
import { escapeHtml } from "../escape.js";

export function renderPublicationRejected(data: PublicationRejectedData): RenderedEmail {
  const heading = "Your note wasn't approved";
  const title = escapeHtml(data.publicationTitle);

  // A plain text link, not the primary button — a bright ember CTA reads as
  // the wrong emotional register right after telling someone no.
  const action = { label: "Start a new draft", href: data.newDraftUrl, variant: "link" as const };

  return {
    subject: heading,
    html: renderLayout({
      preheader: `A note on “${data.publicationTitle}.”`,
      heading,
      bodyHtml: [
        paragraph(`A moderator reviewed “${title}” and didn’t approve it. Here’s what they said:`),
        blockquote(data.reason),
        paragraph("This submission is done, but the draft isn’t gone."),
      ].join(""),
      action,
    }),
    text: renderPlainText({
      heading,
      lines: [
        `A moderator reviewed "${data.publicationTitle}" and didn't approve it. Here's what they said:`,
        `"${data.reason}"`,
        "This submission is done, but the draft isn't gone.",
      ],
      action,
    }),
  };
}
