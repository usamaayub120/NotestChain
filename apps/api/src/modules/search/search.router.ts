import { Router } from "express";
import { searchQuerySchema } from "@noteschain/validation";
import { asyncHandler, paginated } from "../../lib/http.js";
import { searchRateLimit } from "../../middleware/rateLimit.js";
import { searchPublications } from "./search.service.js";

export const searchRouter = Router();

searchRouter.get(
  "/",
  searchRateLimit,
  asyncHandler(async (req, res) => {
    const query = searchQuerySchema.parse(req.query);
    const { items, total } = await searchPublications(query);
    return paginated(res, items, { page: query.page, pageSize: query.pageSize, total });
  }),
);
