/**
 * Translates incoming noteschain.org URLs into this app's routes.
 *
 * app.config.ts claims `https://noteschain.org/*` with `autoVerify: true`, so
 * Android hands the app every link to the site. But the two clients do not
 * share a URL shape: the web reader lives at `/p/:id` and the app's at
 * `/note/[id]`, the web profile at `/@handle` and the app's at
 * `/profile/[username]`.
 *
 * Nothing bridged them. So `shareNote` built `${webOrigin}/p/${id}`, a friend
 * with the app installed tapped it, Android resolved it to NotesChain, and
 * Expo Router found no route and landed them on `+not-found` -  the app's own
 * primary sharing action producing a link its own app could not open.
 *
 * Anything genuinely website-only (marketing, legal, admin) is deliberately
 * left to fall through to `+not-found`, which offers to open it on the web.
 *
 * Note what `path` actually is. Expo Router calls this with the value of
 * `Linking.getInitialURL()`, which for an Android App Link is the whole URL
 * -- "https://noteschain.org/p/<id>" -- and only for a custom-scheme launch
 * is it anything shorter. An earlier version of this file guarded with
 * `if (!path.startsWith("/")) return path`, which bailed out on precisely
 * the input it was written to handle, so every shared link still died on
 * +not-found. The unit tests passed because they fed it "/p/<id>".
 */

const PROFILE = /^\/@([^/]+)\/?$/;
const PUBLICATION = /^\/p\/([^/]+)\/?$/;
const TAG = /^\/tags\/([^/]+)\/?$/;
const DRAFT_EDIT = /^\/drafts\/([^/]+)\/edit\/?$/;

/** The absolute URL an App Link arrives as, or a bare path, split up. */
function split(path: string): { pathname: string; query: string } | null {
  const absolute = /^https?:\/\/[^/]+(\/[^?#]*)?(\?[^#]*)?/.exec(path);
  if (absolute) return { pathname: absolute[1] || "/", query: (absolute[2] || "").replace(/^\?/, "") };
  // A custom-scheme link (noteschain://) already speaks this app's routes.
  if (!path.startsWith("/")) return null;
  const [pathname, query] = path.split("?");
  return { pathname, query: query ?? "" };
}

export function redirectSystemPath({ path }: { path: string; initial: boolean }): string {
  const parts = split(path);
  if (!parts) return path;
  const { pathname, query } = parts;
  const suffix = query ? `?${query}` : "";

  const publication = PUBLICATION.exec(pathname);
  if (publication) return `/note/${publication[1]}${suffix}`;

  const profile = PROFILE.exec(pathname);
  if (profile) return `/profile/${profile[1]}`;

  const draft = DRAFT_EDIT.exec(pathname);
  if (draft) return `/draft/${draft[1]}`;

  // There is no tag screen in the app. Search covers it, and arriving with
  // the tag already in the box is closer to what the link promised than a
  // dead end offering to open the website.
  const tag = TAG.exec(pathname);
  if (tag) return `/search?q=${encodeURIComponent(`#${decodeURIComponent(tag[1])}`)}`;

  // The web's sign-in page; the app keeps sign-in on the account screen.
  if (pathname === "/login" || pathname === "/register") return "/account";

  if (pathname === "/drafts") return "/drafts";

  // Everything else returns as a bare path rather than the absolute URL it
  // arrived as, so route matching never depends on the origin being stripped
  // for us. Routes the app has (/explore, /verify) then resolve normally, and
  // website-only ones (/privacy, /admin/...) match nothing and land on
  // +not-found, which is what offers to open them on the web.
  return `${pathname}${suffix}`;
}
