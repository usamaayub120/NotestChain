import type { PublicationChainFinalizedData } from "../schemas.js";
import type { RenderedPush } from "../render.js";

export function renderPublicationChainFinalized(data: PublicationChainFinalizedData): RenderedPush {
  return {
    title: "Your note is kept",
    body: `"${data.publicationTitle}" is now permanently on the public record.`,
    deepLink: `/note/${data.publicationId}`,
  };
}
