import { z } from "zod";

const androidBuildNumberSchema = z
  .number()
  .int("Must be a whole Android versionCode.")
  .positive("Must be a positive Android versionCode.")
  .max(2_147_483_647, "Android versionCode must fit in a signed 32-bit integer.");

const androidVersionNameSchema = z.string().trim().min(1, "Version name is required.").max(64);

// Output type deliberately mirrors the input shape (plain optional strings,
// no .transform()) — react-hook-form's resolver typing gets fragile once a
// zod schema's output type diverges from its input type across many fields.
// The "" / absent -> null conversion for Prisma happens in
// settings.service.ts instead, right before the update.
export const updateSiteSettingsSchema = z.object({
  ga4MeasurementId: z
    .string()
    .trim()
    .regex(/^G-[A-Z0-9]{4,}$/, "Must look like a GA4 Measurement ID, e.g. G-XXXXXXXXXX.")
    .optional()
    .or(z.literal("")),
  searchConsoleVerification: z.string().trim().max(255).optional().or(z.literal("")),
  defaultMetaDescription: z.string().trim().max(300).optional().or(z.literal("")),
  defaultOgImageUrl: z
    .string()
    .trim()
    .url("Must be a full URL, e.g. https://example.com/og-image.png")
    .optional()
    .or(z.literal("")),
  twitterHandle: z
    .string()
    .trim()
    .regex(/^@?[A-Za-z0-9_]{1,15}$/, "Must be a valid X/Twitter handle, e.g. @noteschain.")
    .optional()
    .or(z.literal("")),
  indexingEnabled: z.boolean(),
  androidLatestBuild: androidBuildNumberSchema.optional(),
  androidMinimumBuild: androidBuildNumberSchema.optional(),
  androidLatestVersion: androidVersionNameSchema.optional(),
}).superRefine((value, ctx) => {
  if (
    value.androidLatestBuild !== undefined &&
    value.androidMinimumBuild !== undefined &&
    value.androidMinimumBuild > value.androidLatestBuild
  ) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["androidMinimumBuild"],
      message: "Minimum Android build must not exceed the latest Android build.",
    });
  }
});
export type UpdateSiteSettingsInput = z.infer<typeof updateSiteSettingsSchema>;

/** Input accepted only from the release automation webhook. */
export const syncAndroidLatestBuildSchema = z.object({
  latestBuild: androidBuildNumberSchema,
  latestVersion: androidVersionNameSchema,
});
export type SyncAndroidLatestBuildInput = z.infer<typeof syncAndroidLatestBuildSchema>;
