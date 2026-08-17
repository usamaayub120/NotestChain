import type { CommentReceivedData } from "../schemas.js";
import { blockquote, paragraph, renderLayout, renderPlainText, type RenderedEmail } from "../layout.js";
import { escapeHtml } from "../escape.js";

export function renderCommentReceived(data: CommentReceivedData): RenderedEmail {
  const heading = `${data.commenterName} commented on "${data.publicationTitle}"`;
  const commenter = escapeHtml(data.commenterName);
  const title = escapeHtml(data.publicationTitle);
  const action = { label: "View comment", href: data.publicationUrl };

  return {
    subject: heading,
    html: renderLayout({
      preheader: "New comment on your kept note.",
      heading,
      bodyHtml: [paragraph(`${commenter} left a comment on “${title}”:`), blockquote(data.commentBody)].join(""),
      action,
    }),
    text: renderPlainText({
      heading,
      lines: [`${data.commenterName} left a comment on "${data.publicationTitle}":`, `"${data.commentBody}"`],
      action,
    }),
  };
}
