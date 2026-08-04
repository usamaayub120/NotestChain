import { Router } from "express";
import { z } from "zod";
import { asyncHandler, ok, paginated, requireParam } from "../../lib/http.js";
import { getProfile, listProfilePublications } from "./profiles.service.js";

export const profilesRouter = Router();

const pageQuerySchema = z.object({
  page: z.coerce.number().int().min(1).max(1000).optional().default(1),
  pageSize: z.coerce.number().int().min(1).max(50).optional().default(20),
});

profilesRouter.get(
  "/:username",
  asyncHandler(async (req, res) => {
    const profile = await getProfile(requireParam(req, "username"));
    return ok(res, profile);
  }),
);

profilesRouter.get(
  "/:username/publications",
  asyncHandler(async (req, res) => {
    const query = pageQuerySchema.parse(req.query);
    const { items, total } = await listProfilePublications(requireParam(req, "username"), query.page, query.pageSize);
    return paginated(res, items, { ...query, total });
  }),
);
