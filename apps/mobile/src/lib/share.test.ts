import { noteShareContent } from "./share";
import { webOrigin } from "./config";

describe("noteShareContent", () => {
  it("points at the web reader route for the note", () => {
    expect(noteShareContent("Some nights", "abc-123").url).toBe(`${webOrigin}/p/abc-123`);
  });

  it("always sends a non-empty message", () => {
    // The regression this file exists for: Android's Share reads only
    // `message`, so a payload carrying just `url` went out with empty text and
    // share targets rejected it as an empty message.
    const content = noteShareContent("Some nights", "abc-123");
    expect(content.message.length).toBeGreaterThan(0);
    expect(content.message).toContain(`${webOrigin}/p/abc-123`);
    expect(content.message).toContain("Some nights");
  });

  it("still sends url alongside message, for iOS", () => {
    expect(noteShareContent("Some nights", "abc-123")).toEqual(
      expect.objectContaining({ url: `${webOrigin}/p/abc-123` }),
    );
  });

  it("falls back to the app name and a bare link when the note has no title", () => {
    const content = noteShareContent("   ", "abc-123");
    expect(content.message).toBe(`${webOrigin}/p/abc-123`);
    expect(content.message.startsWith("\n")).toBe(false);
    expect(content.title).toBe("NotesChain");
  });
});
