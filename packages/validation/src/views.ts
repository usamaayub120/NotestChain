import { z } from "zod";
import { LIMITS } from "@noteschain/shared";

export const recordPublicationViewSchema = z.object({
  utmSource: z.string().trim().max(LIMITS.UTM_PARAM_MAX_LENGTH).optional(),
  utmMedium: z.string().trim().max(LIMITS.UTM_PARAM_MAX_LENGTH).optional(),
  utmCampaign: z.string().trim().max(LIMITS.UTM_PARAM_MAX_LENGTH).optional(),
});
export type RecordPublicationViewInput = z.infer<typeof recordPublicationViewSchema>;
