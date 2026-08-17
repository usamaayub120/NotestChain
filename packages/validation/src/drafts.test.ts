import { describe, expect, it } from "vitest";
import { LIMITS } from "@noteschain/shared";
import { autosaveSchema, draftInputSchema } from "./drafts.js";

const validDraft = (overrides: Record<string, unknown> = {}) => ({
  title: "A title",
  content: "Some words.",
  tags: [],
  identityMode: "ANONYMOUS",
  publicIdentityId: null,
  discoverability: "PUBLIC",
  ...overrides,
});

const bodyErrors = (content: string) => {
  const parsed = draftInputSchema.safeParse(validDraft({ content }));
  return parsed.success ? [] : parsed.error.flatten().fieldErrors.content ?? [];
};

describe("note body length", () => {
  it("accepts a long note far past the old 600-byte limit", () => {
    expect(draftInputSchema.safeParse(validDraft({ content: "word ".repeat(2000) })).success).toBe(true);
  });

  it("accepts exactly the submit limit", () => {
    expect(bodyErrors("a".repeat(LIMITS.NOTE_BODY_MAX_CHARS))).toHaveLength(0);
  });

  it("rejects one character over, and says how many to remove", () => {
    const errors = bodyErrors("a".repeat(LIMITS.NOTE_BODY_MAX_CHARS + 9));
    expect(errors.join(" ")).toContain("9 characters over");
  });

  it("counts an emoji as one character, not four", () => {
    // Under the old byte limit an emoji cost 4. Charging a writer four
    // characters for one visible character is exactly the confusion the
    // "600 bytes" counter created.
    const content = "\u{1F30A}".repeat(LIMITS.NOTE_BODY_MAX_CHARS);
    expect(bodyErrors(content)).toHaveLength(0);
  });

  it("rejects a note whose marks enclose nothing", () => {
    // These pass a naive min(1) check but a reader sees an empty note.
    for (const content of ["****", "====", "** **"]) {
      expect(bodyErrors(content).join(" ")).toContain("only formatting marks");
    }
  });

  it("accepts unmatched markers, which are just literal characters", () => {
    // `***` renders as three asterisks — odd, but it is genuinely something
    // the writer typed and can see. Rejecting it would be the parser
    // swallowing input, which is the behaviour we are moving away from.
    expect(bodyErrors("***")).toHaveLength(0);
    expect(bodyErrors("==  ==")).toHaveLength(0);
  });
});

describe("autosave and submit cannot drift apart", () => {
  const overSubmitLimit = "a".repeat(LIMITS.NOTE_BODY_MAX_CHARS + 500);

  it("still saves a draft that has run past the submit limit", () => {
    // The original bug in reverse: losing a writer's words because they went
    // long would be worse than the problem being fixed.
    expect(autosaveSchema.safeParse({ content: overSubmitLimit }).success).toBe(true);
  });

  it("refuses to submit that same draft", () => {
    expect(draftInputSchema.safeParse(validDraft({ content: overSubmitLimit })).success).toBe(false);
  });

  it("measures both paths in the same unit", () => {
    // The old bug was autosave counting characters while submit counted
    // bytes. An all-emoji body is the case where the two units diverge most,
    // so if either path were still byte-based this would disagree.
    const emoji = "\u{1F30A}".repeat(LIMITS.NOTE_BODY_MAX_CHARS);
    expect(autosaveSchema.safeParse({ content: emoji }).success).toBe(true);
    expect(draftInputSchema.safeParse(validDraft({ content: emoji })).success).toBe(true);
  });

  it("stops saving only at the storage guard", () => {
    const past = "a".repeat(LIMITS.NOTE_BODY_HARD_MAX_CHARS + 1);
    expect(autosaveSchema.safeParse({ content: past }).success).toBe(false);
  });

  it("does not trim mid-typing, so a just-pressed newline survives", () => {
    const parsed = autosaveSchema.parse({ content: "half a thought\n" });
    expect(parsed.content).toBe("half a thought\n");
  });

  it("allows empty fields mid-typing but not at submit", () => {
    expect(autosaveSchema.safeParse({ title: "", content: "" }).success).toBe(true);
    expect(draftInputSchema.safeParse(validDraft({ content: "" })).success).toBe(false);
  });
});

describe("title", () => {
  it("stays byte-limited, because it is still stored on-chain in full", () => {
    const parsed = draftInputSchema.safeParse(validDraft({ title: "a".repeat(LIMITS.TITLE_MAX_BYTES + 1) }));
    expect(parsed.success).toBe(false);
  });

  it("explains that emoji cost more than one byte", () => {
    const parsed = draftInputSchema.safeParse(validDraft({ title: "\u{1F30A}".repeat(30) }));
    expect(parsed.success).toBe(false);
    if (!parsed.success) {
      expect(parsed.error.flatten().fieldErrors.title?.join(" ")).toContain("Emoji");
    }
  });
});
