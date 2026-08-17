import type { PublicationChainFinalizedData } from "../schemas.js";
import {
  paragraph,
  renderLayout,
  renderPlainText,
  technicalDetail,
  technicalDetailText,
  type RenderedEmail,
} from "../layout.js";
import { escapeHtml } from "../escape.js";
import { EMAIL_COLORS } from "../colors.js";

export function renderPublicationChainFinalized(data: PublicationChainFinalizedData): RenderedEmail {
  const heading = `"${data.publicationTitle}" has been kept`;
  const title = escapeHtml(data.publicationTitle);
  const action = { label: "View the kept note", href: data.publicationUrl };

  const technicalHtml = [
    technicalDetail("Where it lives", data.publicationPda),
    data.explorerUrl
      ? paragraph(
          `<a href="${escapeHtml(data.explorerUrl)}" style="color:${EMAIL_COLORS.mutedForeground};text-decoration:underline;font-size:13px;">Look up the transaction</a>`,
        )
      : "",
  ].join("");

  const technicalText = [
    technicalDetailText("Where it lives", data.publicationPda),
    data.explorerUrl ? `Look up the transaction: ${data.explorerUrl}` : "",
  ].filter(Boolean);

  return {
    subject: heading,
    html: renderLayout({
      preheader: "It's part of the public record now, for good.",
      heading,
      bodyHtml: [
        paragraph(
          `“${title}” is kept now. It’s part of the public record, and nothing — not even us — can change or remove it.`,
        ),
        technicalHtml,
      ].join(""),
      action,
    }),
    text: renderPlainText({
      heading,
      lines: [
        `"${data.publicationTitle}" is kept now. It's part of the public record, and nothing — not even us — can change or remove it.`,
        "",
        ...technicalText,
      ],
      action,
    }),
  };
}
