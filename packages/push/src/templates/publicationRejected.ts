import type { PublicationRejectedData } from "../schemas.js";
import type { RenderedPush } from "../render.js";
import { truncateForPush } from "../truncate.js";

export function renderPublicationRejected(data: PublicationRejectedData): RenderedPush {
  return {
    title: "Your submission wasn't approved",
    body: `"${data.publicationTitle}" — ${truncateForPush(data.reason)}`,
    deepLink: `/draft/${data.draftId}`,
  };
}
