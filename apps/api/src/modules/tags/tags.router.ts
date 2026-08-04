import { Router } from "express";
import { z } from "zod";
import { asyncHandler, ok, paginated, requireParam } from "../../lib/http.js";
import { listPublicPublications } from "../publications/publications.service.js";
import { listTags } from "./tags.service.js";

export const tagsRouter = Router();

const pageQuerySchema = z.object({
  page: z.coerce.number().int().min(1).max(1000).optional().default(1),
  pageSize: z.coerce.number().int().min(1).max(50).optional().default(20),
});

tagsRouter.get(
  "/",
  asyncHandler(async (_req, res) => {
    const tags = await listTags();
    return ok(res, tags);
  }),
);

tagsRouter.get(
  "/:slug/publications",
  asyncHandler(async (req, res) => {
    const query = pageQuerySchema.parse(req.query);
    const { items, total } = await listPublicPublications({ ...query, tag: requireParam(req, "slug") });
    return paginated(res, items, { ...query, total });
  }),
);
