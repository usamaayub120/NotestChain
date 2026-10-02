/**
 * The routes the floating tab bar renders on.
 *
 * Its own module because both `MobileNavigation` (which decides whether to
 * draw the bar) and `Screen` (which reserves room for it) need this, and
 * MobileNavigation already imports from ui.tsx -  so putting it in either of
 * them would make the import circular.
 *
 * Screen used to reserve TAB_BAR_HEIGHT unconditionally, so every non-root
 * screen -  the editor, the reader, drafts, settings, profile, bookmarks,
 * analytics, verify, identities, register, delete-account -  held 68px open
 * for a bar that is not drawn there.
 */
export const TAB_BAR_ROUTES: readonly string[] = ["/", "/explore", "/search", "/account"];

export const tabBarShowsOn = (pathname: string) => TAB_BAR_ROUTES.includes(pathname);
