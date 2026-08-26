import type { CommentReceivedData } from "../schemas.js";
import type { RenderedPush } from "../render.js";

export function renderCommentReceived(data: CommentReceivedData): RenderedPush {
  return {
    title: `${data.commenterName} commented on your note`,
    body: `"${data.publicationTitle}" has a new comment.`,
    deepLink: `/note/${data.publicationId}`,
  };
}
