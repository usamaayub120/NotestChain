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
 */

const PROFILE = /^\/@([^/]+)\/?$/;
const PUBLICATION = /^\/p\/([^/]+)\/?$/;
const TAG = /^\/tags\/([^/]+)\/?$/;
const DRAFT_EDIT = /^\/drafts\/([^/]+)\/edit\/?$/;

export function redirectSystemPath({ path }: { path: string; initial: boolean }): string {
  // A custom-scheme link (noteschain://) already speaks this app's routes.
  if (!path.startsWith("/")) return path;

  const [pathname, query] = path.split("?");

  const publication = PUBLICATION.exec(pathname);
  if (publication) return `/note/${publication[1]}${query ? `?${query}` : ""}`;

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

  return path;
}
