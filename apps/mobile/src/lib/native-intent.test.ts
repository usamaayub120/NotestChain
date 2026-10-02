import { redirectSystemPath } from "../../app/+native-intent";

const WEB = "https://noteschain.org";

/**
 * The app claims every noteschain.org link with autoVerify, so these
 * translations are the difference between a shared note opening and the
 * recipient landing on "This isn't in the app yet".
 *
 * Every case drives the *absolute* URL, because that is what Expo Router
 * passes: it hands redirectSystemPath the value of Linking.getInitialURL(),
 * which for an App Link is the full "https://noteschain.org/..." string. An
 * earlier version of this file asserted on bare paths like "/p/abc-123".
 * It passed, in full, against an implementation that returned every real
 * link untouched -- the feature was dead on a device and the suite was
 * green. Bare paths are still covered, at the bottom, as the lesser case.
 */
describe("redirectSystemPath", () => {
  it("opens a shared note, which is the URL shareNote actually builds", () => {
    // src/lib/share.ts builds `${webOrigin}/p/${publicationId}`.
    expect(redirectSystemPath({ path: `${WEB}/p/abc-123`, initial: true })).toBe("/note/abc-123");
  });

  it("keeps a query string on the way through", () => {
    expect(redirectSystemPath({ path: `${WEB}/p/abc-123?utm_source=x`, initial: false })).toBe("/note/abc-123?utm_source=x");
  });

  it("opens a profile from the web's @handle form", () => {
    expect(redirectSystemPath({ path: `${WEB}/@marguerite`, initial: true })).toBe("/profile/marguerite");
  });

  it("sends a tag link to search, since the app has no tag screen", () => {
    expect(redirectSystemPath({ path: `${WEB}/tags/reflection`, initial: true })).toBe("/search?q=%23reflection");
  });

  it("opens a draft at the app's own editor path", () => {
    expect(redirectSystemPath({ path: `${WEB}/drafts/xyz/edit`, initial: false })).toBe("/draft/xyz");
  });

  it("sends the web sign-in and sign-up pages to the account screen", () => {
    expect(redirectSystemPath({ path: `${WEB}/login`, initial: true })).toBe("/account");
    expect(redirectSystemPath({ path: `${WEB}/register`, initial: true })).toBe("/account");
  });

  it("rewrites routes the app already has to their bare path", () => {
    for (const route of ["/explore", "/search", "/account", "/verify", "/drafts"]) {
      expect(redirectSystemPath({ path: `${WEB}${route}`, initial: true })).toBe(route);
    }
    expect(redirectSystemPath({ path: WEB, initial: true })).toBe("/");
    expect(redirectSystemPath({ path: `${WEB}/`, initial: true })).toBe("/");
  });

  it("leaves website-only pages alone so +not-found can offer the web", () => {
    for (const route of ["/how-it-works", "/privacy", "/terms", "/admin/submissions"]) {
      expect(redirectSystemPath({ path: `${WEB}${route}`, initial: true })).toBe(route);
    }
  });

  it("passes custom-scheme links straight through", () => {
    expect(redirectSystemPath({ path: "noteschain://note/abc", initial: true })).toBe("noteschain://note/abc");
  });

  it("does not mistake a nested path for a profile or a note", () => {
    expect(redirectSystemPath({ path: `${WEB}/p/abc/extra`, initial: true })).toBe("/p/abc/extra");
    expect(redirectSystemPath({ path: `${WEB}/@someone/else`, initial: true })).toBe("/@someone/else");
  });

  it("still handles a bare path, which is what a warm-start link can carry", () => {
    expect(redirectSystemPath({ path: "/p/abc-123", initial: false })).toBe("/note/abc-123");
    expect(redirectSystemPath({ path: "/explore", initial: false })).toBe("/explore");
  });
});
