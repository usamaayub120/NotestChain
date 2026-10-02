import { describe, expect, it } from "vitest";
import { DraftStatus } from "./enums.js";
import {
  DRAFT_STATUS_LABELS,
  formatJoinedDate,
  formatNoteDate,
  formatRelativeTime,
  identityKindLabel,
} from "./labels.js";

describe("draft status labels", () => {
  it("covers every status, so a new one can't render as a raw enum name", () => {
    for (const status of Object.values(DraftStatus)) {
      expect(DRAFT_STATUS_LABELS[status], status).toBeTruthy();
    }
  });

  it("says the same thing for both in-flight chain states", () => {
    // These shipped as four different strings across the two clients.
    expect(DRAFT_STATUS_LABELS.CHAIN_PENDING).toBe(DRAFT_STATUS_LABELS.CHAIN_SUBMITTED);
  });

  it("never leaks an enum name", () => {
    for (const label of Object.values(DRAFT_STATUS_LABELS)) {
      expect(label).not.toMatch(/_/);
      expect(label).not.toBe(label.toUpperCase());
    }
  });
});

describe("identity kind label", () => {
  it("says Keeper profile, which is what DESIGN_SYSTEM.md §11 and §12 specify", () => {
    expect(identityKindLabel(true)).toBe("Keeper profile");
    expect(identityKindLabel(false)).toBe("Pen name");
  });

  it("never says 'Primary profile', which is database language", () => {
    expect(identityKindLabel(true)).not.toMatch(/primary/i);
  });
});

describe("relative time", () => {
  const now = new Date("2026-10-02T12:00:00Z").getTime();
  const ago = (ms: number) => new Date(now - ms).toISOString();

  it("reads the way §11's card mock does", () => {
    expect(formatRelativeTime(ago(30_000), now)).toBe("just now");
    expect(formatRelativeTime(ago(5 * 60_000), now)).toBe("5m ago");
    expect(formatRelativeTime(ago(2 * 3_600_000), now)).toBe("2h ago");
    expect(formatRelativeTime(ago(3 * 86_400_000), now)).toBe("3d ago");
  });

  it("falls back to an absolute date past a month, rather than '45d ago'", () => {
    const old = ago(60 * 86_400_000);
    expect(formatRelativeTime(old, now)).toBe(formatNoteDate(old));
    expect(formatRelativeTime(old, now)).not.toMatch(/ago/);
  });

  it("never produces the raw numeric locale form the cards used to show", () => {
    // "10/1/2026" is ambiguous internationally and was what shipped.
    expect(formatNoteDate("2026-10-01T00:00:00Z")).not.toMatch(/^\d+\/\d+\/\d+$/);
    expect(formatJoinedDate("2025-01-15T00:00:00Z")).not.toMatch(/^\d+\/\d+\/\d+$/);
  });
});
