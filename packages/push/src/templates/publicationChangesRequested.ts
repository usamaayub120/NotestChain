import type { PublicationChangesRequestedData } from "../schemas.js";
import type { RenderedPush } from "../render.js";
import { truncateForPush } from "../truncate.js";

export function renderPublicationChangesRequested(data: PublicationChangesRequestedData): RenderedPush {
  return {
    title: "Changes requested on your note",
    body: `"${data.publicationTitle}" — ${truncateForPush(data.reason)}`,
    deepLink: `/draft/${data.draftId}`,
  };
}
