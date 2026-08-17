import { describe, expect, it } from "vitest";
import { EmailKind } from "./kinds.js";
import { EMAIL_TEMPLATES, buildEmailJobData, renderEmail } from "./registry.js";

const FIXTURES: Record<string, Record<string, unknown>> = {
  [EmailKind.PUBLICATION_APPROVED]: {
    publicationTitle: "A short thought",
    draftEditUrl: "https://notes.example/drafts/1/edit",
  },
  [EmailKind.PUBLICATION_REJECTED]: {
    publicationTitle: "A short thought",
    reason: "This repeats another submission.",
    newDraftUrl: "https://notes.example/drafts",
  },
  [EmailKind.PUBLICATION_CHANGES_REQUESTED]: {
    publicationTitle: "A short thought",
    reason: "Please remove the phone number in paragraph two.",
    draftEditUrl: "https://notes.example/drafts/1/edit",
  },
  [EmailKind.PUBLICATION_CHAIN_FINALIZED]: {
    publicationTitle: "A short thought",
    publicationUrl: "https://notes.example/p/1",
    publicationPda: "9xQe...pda",
    explorerUrl: "https://explorer.solana.com/tx/abc?cluster=devnet",
  },
  [EmailKind.PASSWORD_RESET_REQUESTED]: {
    resetUrl: "https://notes.example/reset-password?token=abc",
    expiryMinutes: 30,
  },
  [EmailKind.ACCOUNT_WELCOME]: {
    startWritingUrl: "https://notes.example/drafts",
  },
  [EmailKind.COMMENT_RECEIVED]: {
    publicationTitle: "A short thought",
    publicationUrl: "https://notes.example/p/1",
    commenterName: "Someone",
    commentBody: "This resonated.",
  },
};

describe("every EmailKind has a fixture and a registry entry", () => {
  it("covers every kind", () => {
    const kinds = Object.values(EmailKind);
    expect(Object.keys(FIXTURES).sort()).toEqual(kinds.sort());
    expect(Object.keys(EMAIL_TEMPLATES).sort()).toEqual(kinds.sort());
  });
});

describe.each(Object.values(EmailKind))("%s", (kind) => {
  const fixture = FIXTURES[kind]!;

  it("round-trips through buildEmailJobData and renderEmail", () => {
    const jobData = buildEmailJobData(kind, fixture as never);
    const rendered = renderEmail(kind, jobData);
    expect(rendered.subject.length).toBeGreaterThan(0);
    expect(rendered.html).toContain("<!doctype html>");
    expect(rendered.text.length).toBeGreaterThan(0);
  });

  it("rejects a payload missing a required field", () => {
    const broken = { ...fixture };
    const [firstKey] = Object.keys(broken);
    delete broken[firstKey!];
    expect(() => buildEmailJobData(kind, broken as never)).toThrow();
  });

  it("includes the brand tagline in both the html and text bodies", () => {
    const rendered = renderEmail(kind, fixture);
    expect(rendered.html).toContain("Thoughts worth keeping.");
    expect(rendered.text).toContain("Thoughts worth keeping.");
  });
});

describe("HTML injection safety", () => {
  const PAYLOAD = `<script>alert(1)</script>"'&`;

  it("escapes a hostile publication title everywhere it's interpolated", () => {
    const rendered = renderEmail(EmailKind.PUBLICATION_APPROVED, {
      publicationTitle: PAYLOAD,
      draftEditUrl: "https://notes.example/drafts/1/edit",
    });
    expect(rendered.html).not.toContain("<script>");
    expect(rendered.html).toContain("&lt;script&gt;");
  });

  it("escapes a hostile moderation reason inside the blockquote", () => {
    const rendered = renderEmail(EmailKind.PUBLICATION_REJECTED, {
      publicationTitle: "Fine",
      reason: PAYLOAD,
      newDraftUrl: "https://notes.example/drafts",
    });
    expect(rendered.html).not.toContain("<script>");
    expect(rendered.html).toContain("&lt;script&gt;");
  });

  it("escapes a hostile comment body", () => {
    const rendered = renderEmail(EmailKind.COMMENT_RECEIVED, {
      publicationTitle: "Fine",
      publicationUrl: "https://notes.example/p/1",
      commenterName: "Someone",
      commentBody: PAYLOAD,
    });
    expect(rendered.html).not.toContain("<script>");
    expect(rendered.html).toContain("&lt;script&gt;");
  });

  it("escapes a hostile commenter name, which also lands in the subject", () => {
    const rendered = renderEmail(EmailKind.COMMENT_RECEIVED, {
      publicationTitle: "Fine",
      publicationUrl: "https://notes.example/p/1",
      commenterName: PAYLOAD,
      commentBody: "hi",
    });
    expect(rendered.html).not.toContain("<script>");
    // The subject line is a mail header, not HTML — it legitimately carries
    // the raw value; only the HTML body needs escaping.
    expect(rendered.subject).toContain(PAYLOAD);
  });

  it("rejects a non-URL action link rather than emitting an unsafe href", () => {
    expect(() =>
      buildEmailJobData(EmailKind.PASSWORD_RESET_REQUESTED, {
        resetUrl: "javascript:alert(1)",
        expiryMinutes: 30,
      }),
    ).toThrow();
  });
});

describe("PUBLICATION_REJECTED uses a quiet link, not the primary button", () => {
  it("does not render the ember button background for its action", () => {
    const rendered = renderEmail(EmailKind.PUBLICATION_REJECTED, FIXTURES[EmailKind.PUBLICATION_REJECTED]!);
    expect(rendered.html).not.toContain("background-color:#E1502F");
  });
});

describe("PUBLICATION_CHAIN_FINALIZED", () => {
  it("shows the PDA in a monospace block", () => {
    const rendered = renderEmail(EmailKind.PUBLICATION_CHAIN_FINALIZED, FIXTURES[EmailKind.PUBLICATION_CHAIN_FINALIZED]!);
    expect(rendered.html).toContain("9xQe...pda");
    expect(rendered.html).toContain("ui-monospace");
  });

  it("omits the explorer link entirely when none is available, rather than a broken href", () => {
    const rendered = renderEmail(EmailKind.PUBLICATION_CHAIN_FINALIZED, {
      ...FIXTURES[EmailKind.PUBLICATION_CHAIN_FINALIZED]!,
      explorerUrl: null,
    });
    expect(rendered.html).not.toContain("Look up the transaction");
  });

  it("never says 'blockchain' or 'hash' in the reader-facing body", () => {
    const rendered = renderEmail(EmailKind.PUBLICATION_CHAIN_FINALIZED, FIXTURES[EmailKind.PUBLICATION_CHAIN_FINALIZED]!);
    expect(rendered.html.toLowerCase()).not.toContain("blockchain");
    expect(rendered.html.toLowerCase()).not.toContain("hash");
  });
});
