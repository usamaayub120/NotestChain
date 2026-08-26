import { Router } from "express";
import { peopleSearchQuerySchema, searchQuerySchema } from "@noteschain/validation";
import { asyncHandler, paginated } from "../../lib/http.js";
import { searchRateLimit } from "../../middleware/rateLimit.js";
import { searchPeople, searchPublications } from "./search.service.js";

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

// Separate from GET / because it searches a different table (PublicIdentity,
// not Publication) with a different result shape — see searchPeople's doc
// comment for the visibility rule.
searchRouter.get(
  "/people",
  searchRateLimit,
  asyncHandler(async (req, res) => {
    const query = peopleSearchQuerySchema.parse(req.query);
    const { items, total } = await searchPeople(query.q, query.page, query.pageSize);
    return paginated(res, items, { page: query.page, pageSize: query.pageSize, total });
  }),
);
