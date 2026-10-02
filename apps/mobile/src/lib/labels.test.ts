import { readFileSync } from "node:fs";
import { join } from "node:path";
import { DRAFT_STATUS_LABELS, IDENTITY_KIND_LABEL, formatRelativeTime } from "./labels";

/**
 * The mobile workspace mirrors packages/shared rather than importing it,
 * which is a deliberate arrangement (see labels.ts) with one obvious failure
 * mode: the two copies drifting apart and nobody noticing until a reader
 * sees the app and the website call the same thing by different names.
 *
 * So this reads the real source file and compares the strings. It is the
 * only thing standing between the arrangement and the problem it exists to
 * solve.
 */
const sharedSource = readFileSync(
  join(__dirname, "..", "..", "..", "..", "packages", "shared", "src", "labels.ts"),
  "utf8",
);

describe("mobile labels mirror packages/shared", () => {
  it("uses the same wording for every draft status", () => {
    for (const [status, label] of Object.entries(DRAFT_STATUS_LABELS)) {
      expect(sharedSource).toContain(`[DraftStatus.${status}]: ${JSON.stringify(label)}`);
    }
  });

  it("uses the same byline vocabulary", () => {
    expect(sharedSource).toContain(`keeper: ${JSON.stringify(IDENTITY_KIND_LABEL.keeper)}`);
    expect(sharedSource).toContain(`pen: ${JSON.stringify(IDENTITY_KIND_LABEL.pen)}`);
  });

  it("formats relative time the same way", () => {
    const now = new Date("2026-10-02T12:00:00Z").getTime();
    const ago = (ms: number) => new Date(now - ms).toISOString();
    expect(formatRelativeTime(ago(30_000), now)).toBe("just now");
    expect(formatRelativeTime(ago(5 * 60_000), now)).toBe("5m ago");
    expect(formatRelativeTime(ago(2 * 3_600_000), now)).toBe("2h ago");
    expect(formatRelativeTime(ago(3 * 86_400_000), now)).toBe("3d ago");
  });
});
