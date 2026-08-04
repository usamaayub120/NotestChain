import { useParams } from "react-router-dom";
import { ProfilePage } from "./ProfilePage";
import { NotFoundPage } from "./NotFoundPage";

/**
 * React Router v6 can't express "/@:username" directly — a path segment
 * can't mix a static prefix with a dynamic param (confirmed empirically:
 * matchPath('/@:username', '/@x') returns null). This matches the plain
 * "/:handle" segment instead and does the "@" split here, so the product
 * spec's required /@username URL still works.
 */
export function ProfileHandleRoute() {
  const { handle } = useParams<{ handle: string }>();
  if (!handle?.startsWith("@") || handle.length < 2) {
    return <NotFoundPage />;
  }
  return <ProfilePage usernameOverride={handle.slice(1)} />;
}
