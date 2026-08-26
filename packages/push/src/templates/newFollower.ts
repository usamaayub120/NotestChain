import type { NewFollowerData } from "../schemas.js";
import type { RenderedPush } from "../render.js";

export function renderNewFollower(data: NewFollowerData): RenderedPush {
  return {
    title: `New follower on @${data.targetUsername}`,
    body: `${data.followerDisplayName} (@${data.followerUsername}) is now following you.`,
    deepLink: `/profile/${data.followerUsername}`,
  };
}
