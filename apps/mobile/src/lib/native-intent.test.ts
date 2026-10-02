import { redirectSystemPath } from "../../app/+native-intent";

/**
 * The app claims every noteschain.org link with autoVerify, so these
 * translations are the difference between a shared note opening and the
 * recipient landing on "This isn't in the app yet".
 */
describe("redirectSystemPath", () => {
  it("opens a shared note, which is the URL shareNote actually builds", () => {
    // src/lib/share.ts builds `${webOrigin}/p/${publicationId}`.
    expect(redirectSystemPath({ path: "/p/abc-123", initial: true })).toBe("/note/abc-123");
  });

  it("keeps a query string on the way through", () => {
    expect(redirectSystemPath({ path: "/p/abc-123?utm_source=x", initial: false })).toBe("/note/abc-123?utm_source=x");
  });

  it("opens a profile from the web's @handle form", () => {
    expect(redirectSystemPath({ path: "/@marguerite", initial: true })).toBe("/profile/marguerite");
  });

  it("sends a tag link to search, since the app has no tag screen", () => {
    expect(redirectSystemPath({ path: "/tags/reflection", initial: true })).toBe("/search?q=%23reflection");
  });

  it("opens a draft at the app's own editor path", () => {
    expect(redirectSystemPath({ path: "/drafts/xyz/edit", initial: false })).toBe("/draft/xyz");
  });

  it("sends the web sign-in and sign-up pages to the account screen", () => {
    expect(redirectSystemPath({ path: "/login", initial: true })).toBe("/account");
    expect(redirectSystemPath({ path: "/register", initial: true })).toBe("/account");
  });

  it("leaves routes the app already has alone", () => {
    for (const path of ["/", "/explore", "/search", "/account", "/verify", "/drafts"]) {
      expect(redirectSystemPath({ path, initial: true })).toBe(path);
    }
  });

  it("leaves website-only pages alone so +not-found can offer the web", () => {
    for (const path of ["/how-it-works", "/privacy", "/terms", "/admin/submissions"]) {
      expect(redirectSystemPath({ path, initial: true })).toBe(path);
    }
  });

  it("passes custom-scheme paths straight through", () => {
    expect(redirectSystemPath({ path: "noteschain://note/abc", initial: true })).toBe("noteschain://note/abc");
  });

  it("does not mistake a nested path for a profile or a note", () => {
    expect(redirectSystemPath({ path: "/p/abc/extra", initial: true })).toBe("/p/abc/extra");
    expect(redirectSystemPath({ path: "/@someone/else", initial: true })).toBe("/@someone/else");
  });
});
