import { z } from "zod";

const deepLink = z.string().trim().refine((value) => ["/", "/account", "/onboarding", "/explore"].includes(value), {
  message: "Campaign deep link must be an approved in-app route.",
});

export const campaignAudienceSchema = z.object({
  target: z.enum(["SIGNED_IN", "ANONYMOUS"]),
  minAgeDays: z.number().int().min(0).max(365).optional(),
  inactiveDays: z.number().int().min(0).max(365).optional(),
  platform: z.enum(["ANDROID", "IOS"]).optional(),
  hasPublished: z.boolean().optional(),
});

export const campaignScheduleSchema = z.object({
  scheduledAt: z.coerce.date(),
  recurring: z.boolean().default(false),
  intervalDays: z.number().int().min(1).max(365).optional(),
  timeZone: z.string().trim().min(1).max(64).default("Asia/Karachi"),
}).superRefine((value, ctx) => {
  if (value.recurring && !value.intervalDays) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["intervalDays"], message: "Recurring campaigns need an interval." });
});

export const createCampaignSchema = z.object({
  name: z.string().trim().min(3).max(120),
  objective: z.enum(["ONBOARDING", "REENGAGEMENT", "ANNOUNCEMENT"]),
  title: z.string().trim().min(3).max(80),
  body: z.string().trim().min(3).max(240),
  deepLink,
  audience: campaignAudienceSchema,
  schedule: campaignScheduleSchema,
});
export type CreateCampaignInput = z.infer<typeof createCampaignSchema>;

export const updateCampaignSchema = createCampaignSchema.omit({ name: true, objective: true });
export type UpdateCampaignInput = z.infer<typeof updateCampaignSchema>;
