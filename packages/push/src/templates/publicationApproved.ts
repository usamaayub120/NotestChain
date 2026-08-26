import type { PublicationApprovedData } from "../schemas.js";
import type { RenderedPush } from "../render.js";

export function renderPublicationApproved(data: PublicationApprovedData): RenderedPush {
  return {
    title: "Your note was approved",
    body: `"${data.publicationTitle}" can be published permanently whenever you're ready.`,
    deepLink: `/draft/${data.draftId}`,
  };
}
