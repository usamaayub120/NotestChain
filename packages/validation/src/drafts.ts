import { z } from "zod";
import { Discoverability, IdentityMode, LIMITS, utf8ByteLength } from "@noteschain/shared";

const titleField = z
  .string()
  .trim()
  .min(1, "Title is required")
  .superRefine((value, ctx) => {
    if (utf8ByteLength(value) > LIMITS.TITLE_MAX_BYTES) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `Title must be at most ${LIMITS.TITLE_MAX_BYTES} UTF-8 bytes`,
      });
    }
  });

const bodyField = z
  .string()
  .trim()
  .min(1, "Body is required")
  .superRefine((value, ctx) => {
    if (utf8ByteLength(value) > LIMITS.BODY_MAX_BYTES) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `Body must be at most ${LIMITS.BODY_MAX_BYTES} UTF-8 bytes`,
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

// Autosave accepts a partial, in-progress draft — title/content may be
// empty mid-typing, so byte limits are checked but "required" is relaxed.
export const autosaveSchema = z.object({
  title: z.string().max(LIMITS.TITLE_MAX_BYTES * 4).optional(),
  content: z.string().max(LIMITS.BODY_MAX_BYTES * 4).optional(),
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
