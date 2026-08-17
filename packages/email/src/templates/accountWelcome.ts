import type { AccountWelcomeData } from "../schemas.js";
import { paragraph, renderLayout, renderPlainText, type RenderedEmail } from "../layout.js";

export function renderAccountWelcome(data: AccountWelcomeData): RenderedEmail {
  const heading = "Welcome to NotesChain";
  const action = { label: "Start writing", href: data.startWritingUrl };

  return {
    subject: heading,
    html: renderLayout({
      preheader: "Thoughts worth keeping — yours, whenever you're ready.",
      heading,
      bodyHtml: [
        paragraph(
          "Your account is ready. Write something short or long, save it as a draft, and decide later if it’s worth keeping for good.",
        ),
        paragraph("Nothing you write is public until you choose to submit it."),
      ].join(""),
      action,
    }),
    text: renderPlainText({
      heading,
      lines: [
        "Your account is ready. Write something short or long, save it as a draft, and decide later if it's worth keeping for good.",
        "Nothing you write is public until you choose to submit it.",
      ],
      action,
    }),
  };
}
