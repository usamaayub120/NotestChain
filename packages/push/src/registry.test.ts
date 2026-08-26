import { describe, expect, it } from "vitest";
import { PushKind } from "./kinds.js";
import { PUSH_TEMPLATES, buildPushJobData, renderPush } from "./registry.js";

const FIXTURES: Record<string, Record<string, unknown>> = {
  [PushKind.COMMENT_RECEIVED]: {
    publicationId: "pub-1",
    publicationTitle: "A short thought",
    commenterName: "Someone",
  },
  [PushKind.PUBLICATION_APPROVED]: {
    draftId: "draft-1",
    publicationTitle: "A short thought",
  },
  [PushKind.PUBLICATION_REJECTED]: {
    draftId: "draft-1",
    publicationTitle: "A short thought",
    reason: "This repeats another submission.",
  },
  [PushKind.PUBLICATION_CHANGES_REQUESTED]: {
    draftId: "draft-1",
    publicationTitle: "A short thought",
    reason: "Please remove the phone number in paragraph two.",
  },
  [PushKind.PUBLICATION_CHAIN_FINALIZED]: {
    publicationId: "pub-1",
    publicationTitle: "A short thought",
  },
  [PushKind.NEW_FOLLOWER]: {
    followerUsername: "marguerite",
    followerDisplayName: "Marguerite Vale",
    targetUsername: "nightwire",
    targetDisplayName: "Night Wire",
  },
};

describe("every PushKind has a fixture and a registry entry", () => {
  it("covers every kind", () => {
    const kinds = Object.values(PushKind);
    expect(Object.keys(FIXTURES).sort()).toEqual(kinds.sort());
    expect(Object.keys(PUSH_TEMPLATES).sort()).toEqual(kinds.sort());
  });
});

describe.each(Object.values(PushKind))("%s", (kind) => {
  const fixture = FIXTURES[kind]!;

  it("round-trips through buildPushJobData and renderPush", () => {
    const jobData = buildPushJobData(kind, fixture as never);
    const rendered = renderPush(kind, jobData);
    expect(rendered.title.length).toBeGreaterThan(0);
    expect(rendered.body.length).toBeGreaterThan(0);
    expect(rendered.deepLink.startsWith("/")).toBe(true);
  });

  it("rejects a payload missing a required field", () => {
    const broken = { ...fixture };
    const [firstKey] = Object.keys(broken);
    delete broken[firstKey!];
    expect(() => buildPushJobData(kind, broken as never)).toThrow();
  });
});

describe("moderation reason truncation", () => {
  const longReason = "x".repeat(2000);

  it("keeps a PUBLICATION_REJECTED body well under FCM's practical display limit", () => {
    const rendered = renderPush(PushKind.PUBLICATION_REJECTED, { ...FIXTURES[PushKind.PUBLICATION_REJECTED], reason: longReason });
    expect(rendered.body.length).toBeLessThan(200);
  });

  it("keeps a PUBLICATION_CHANGES_REQUESTED body well under FCM's practical display limit", () => {
    const rendered = renderPush(PushKind.PUBLICATION_CHANGES_REQUESTED, {
      ...FIXTURES[PushKind.PUBLICATION_CHANGES_REQUESTED],
      reason: longReason,
    });
    expect(rendered.body.length).toBeLessThan(200);
  });
});

describe("deep links point at the right screen", () => {
  it("COMMENT_RECEIVED and PUBLICATION_CHAIN_FINALIZED link to the note", () => {
    expect(renderPush(PushKind.COMMENT_RECEIVED, FIXTURES[PushKind.COMMENT_RECEIVED]).deepLink).toBe("/note/pub-1");
    expect(renderPush(PushKind.PUBLICATION_CHAIN_FINALIZED, FIXTURES[PushKind.PUBLICATION_CHAIN_FINALIZED]).deepLink).toBe(
      "/note/pub-1",
    );
  });

  it("moderation decisions link to the draft, not the (not yet published) note", () => {
    expect(renderPush(PushKind.PUBLICATION_APPROVED, FIXTURES[PushKind.PUBLICATION_APPROVED]).deepLink).toBe("/draft/draft-1");
    expect(renderPush(PushKind.PUBLICATION_REJECTED, FIXTURES[PushKind.PUBLICATION_REJECTED]).deepLink).toBe("/draft/draft-1");
  });

  it("NEW_FOLLOWER links to the follower's profile, not the recipient's own", () => {
    expect(renderPush(PushKind.NEW_FOLLOWER, FIXTURES[PushKind.NEW_FOLLOWER]).deepLink).toBe("/profile/marguerite");
  });
});
