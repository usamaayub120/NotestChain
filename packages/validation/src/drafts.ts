import { z } from "zod";
import {
  Discoverability,
  IdentityMode,
  LIMITS,
  charactersOverLimit,
  markdownToPlainText,
  utf8ByteLength,
} from "@noteschain/shared";

// The autosave/submit split is built out of shared bases rather than written
// twice.
//
// The bug this replaces: autosave capped `BODY_MAX_BYTES * 4` CHARACTERS
// while submit capped `BODY_MAX_BYTES` BYTES. Two units, two unrelated
// numbers — so a writer could autosave 2,400 characters, be told "Saved"
// after every keystroke, and only discover at submit that the real limit was
// 600 bytes.
//
// Now both paths measure the body the same way, in the same unit, from the
// same constants. They still allow different amounts, but that difference is
// deliberate and named:
//
//   NOTE_BODY_MAX_CHARS       submit limit  — what a note must meet to publish
//   NOTE_BODY_HARD_MAX_CHARS  storage guard — what we will still save for you
//
// Going over the submit limit keeps saving and blocks submission with a
// stated reason. It never costs the writer their words.

const titleBase = z.string().superRefine((value, ctx) => {
  // Still measured in bytes: the title is stored on-chain in full, where the
  // account allocation is what constrains it.
  const overBy = utf8ByteLength(value) - LIMITS.TITLE_MAX_BYTES;
  if (overBy > 0) {
    ctx.addIssue({
      code: z.ZodIssueCode.too_big,
      type: "string",
      maximum: LIMITS.TITLE_MAX_BYTES,
      inclusive: true,
      message: `Title is too long by ${overBy} ${overBy === 1 ? "byte" : "bytes"}. Emoji and accented letters take more than one byte each.`,
    });
  }
});

/** Storage guard only — what we will still accept and save. */
const bodyBase = z.string().superRefine((value, ctx) => {
  if (charactersOverLimit(value, LIMITS.NOTE_BODY_HARD_MAX_CHARS) > 0) {
    ctx.addIssue({
      code: z.ZodIssueCode.too_big,
      type: "string",
      maximum: LIMITS.NOTE_BODY_HARD_MAX_CHARS,
      inclusive: true,
      message: "This note is too long to save.",
    });
  }
});

const titleField = titleBase.transform((v) => v.trim()).pipe(z.string().min(1, "Title is required"));

const bodyField = bodyBase
  .superRefine((value, ctx) => {
    // Measured in characters, not bytes. The body no longer enters a Solana
    // transaction, so nothing about it is byte-constrained — and "characters"
    // is the only unit a person writing prose can act on. The message names
    // an exact number they can act on, rather than just "too long".
    const overBy = charactersOverLimit(value, LIMITS.NOTE_BODY_MAX_CHARS);
    if (overBy > 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.too_big,
        type: "string",
        maximum: LIMITS.NOTE_BODY_MAX_CHARS,
        inclusive: true,
        message: `This note is ${overBy.toLocaleString()} ${overBy === 1 ? "character" : "characters"} over the limit.`,
      });
    }
  })
  .transform((v) => v.trim())
  .pipe(z.string().min(1, "Body is required"))
  .superRefine((value, ctx) => {
    // `***` passes a min(1) check but is not a note. Measure what a reader
    // would actually see.
    if (markdownToPlainText(value).trim().length === 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "This note is only formatting marks — add some words.",
      });
    }
  });

const tagSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(1)
  .max(LIMITS.TAG_MAX_LENGTH)
  .regex(/^[a-z0-9-]+$/, "Tags may only contain lowercase letters, numbers and -");

const draftFieldsSchema = z.object({
  title: titleField,
  content: bodyField,
  tags: z.array(tagSchema).max(LIMITS.MAX_TAGS_PER_PUBLICATION).optional().default([]),
  identityMode: z.enum([IdentityMode.NAMED, IdentityMode.PSEUDONYMOUS, IdentityMode.ANONYMOUS]),
  publicIdentityId: z.string().uuid().optional().nullable(),
  discoverability: z.enum([Discoverability.PUBLIC, Discoverability.UNLISTED]),
});

function checkIdentityConsistency(
  value: { identityMode?: IdentityMode; publicIdentityId?: string | null },
  ctx: z.RefinementCtx,
) {
  const needsIdentity = value.identityMode === IdentityMode.NAMED || value.identityMode === IdentityMode.PSEUDONYMOUS;
  if (needsIdentity && !value.publicIdentityId) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["publicIdentityId"],
      message: "Select a public identity for named or pseudonymous publication",
    });
  }
  if (value.identityMode === IdentityMode.ANONYMOUS && value.publicIdentityId) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["publicIdentityId"],
      message: "Anonymous publications must not reference a public identity",
    });
  }
}

// Full, strict shape — required at submit time.
export const draftInputSchema = draftFieldsSchema.superRefine(checkIdentityConsistency);
export type DraftInput = z.infer<typeof draftInputSchema>;

// Editing an in-progress draft: every field optional (the author may be
// mid-change, e.g. switching identityMode before picking a new identity),
// cross-field consistency is only enforced at submit time.
export const updateDraftSchema = draftFieldsSchema.partial();
export type UpdateDraftInput = z.infer<typeof updateDraftSchema>;

// Creating a fresh draft — same leniency as an edit (everything optional,
// schema defaults fill in the rest).
export const createDraftSchema = updateDraftSchema;
export type CreateDraftInput = z.infer<typeof createDraftSchema>;

// Autosave accepts a partial, in-progress draft. Same bases, so the same
// maximum in the same unit as submit — only two things differ, both
// deliberately:
//
//   1. "required" is relaxed: title and content may be empty mid-typing.
//   2. It does NOT trim. Trimming an in-progress draft eats the trailing
//      newline the author just pressed, which is a genuinely irritating
//      editor bug. Normalisation happens once, at submit.
//
// It uses the storage guard rather than the submit limit, so a draft that
// has run long keeps saving. A writer must never lose words for having gone
// over. The lie was never that we saved it; it was that "Saved" implied
// "ready to submit" — fixed in the editor's status copy, not by refusing to
// save.
export const autosaveSchema = z.object({
  title: titleBase.optional(),
  content: bodyBase.optional(),
});
export type AutosaveInput = z.infer<typeof autosaveSchema>;

export const restoreVersionSchema = z.object({
  versionId: z.string().uuid(),
});

export const submitDraftSchema = z.object({
  acknowledgeIrreversible: z.literal(true, {
    errorMap: () => ({ message: "You must acknowledge the irreversible publication notice" }),
  }),
});
export type SubmitDraftInput = z.infer<typeof submitDraftSchema>;
