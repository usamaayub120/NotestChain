import { z } from "zod";
import { IdentityMode } from "@noteschain/shared";

export const searchQuerySchema = z.object({
  q: z.string().trim().max(200).optional(),
  tag: z.string().trim().toLowerCase().max(24).optional(),
  author: z.string().trim().toLowerCase().max(30).optional(),
  identityMode: z.enum([IdentityMode.NAMED, IdentityMode.PSEUDONYMOUS, IdentityMode.ANONYMOUS]).optional(),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
  sort: z.enum(["relevance", "newest", "oldest"]).optional().default("relevance"),
  page: z.coerce.number().int().min(1).max(1000).optional().default(1),
  pageSize: z.coerce.number().int().min(1).max(50).optional().default(20),
});
export type SearchQueryInput = z.infer<typeof searchQuerySchema>;
