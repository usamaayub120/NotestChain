import { Router } from "express";
import { bookmarkCollectionSchema, createBookmarkSchema } from "@noteschain/validation";
import { asyncHandler, ok, requireParam } from "../../lib/http.js";
import { requireAuth } from "../../middleware/auth.js";
import {
  createBookmark,
  createCollection,
  deleteCollection,
  listBookmarks,
  listCollections,
  removeBookmark,
  updateCollection,
} from "./bookmarks.service.js";

export const bookmarksRouter = Router();
bookmarksRouter.use(requireAuth);

bookmarksRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    const bookmarks = await listBookmarks(req.auth!.userId);
    return ok(res, bookmarks);
  }),
);

bookmarksRouter.post(
  "/",
  asyncHandler(async (req, res) => {
    const input = createBookmarkSchema.parse(req.body);
    const bookmark = await createBookmark(req.auth!.userId, input.publicationId, input.collectionId);
    return ok(res, bookmark, 201);
  }),
);

bookmarksRouter.delete(
  "/:publicationId",
  asyncHandler(async (req, res) => {
    await removeBookmark(req.auth!.userId, requireParam(req, "publicationId"));
    return ok(res, { success: true });
  }),
);

export const bookmarkCollectionsRouter = Router();
bookmarkCollectionsRouter.use(requireAuth);

bookmarkCollectionsRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    const collections = await listCollections(req.auth!.userId);
    return ok(res, collections);
  }),
);

bookmarkCollectionsRouter.post(
  "/",
  asyncHandler(async (req, res) => {
    const input = bookmarkCollectionSchema.parse(req.body);
    const collection = await createCollection(req.auth!.userId, input.name);
    return ok(res, collection, 201);
  }),
);

bookmarkCollectionsRouter.patch(
  "/:id",
  asyncHandler(async (req, res) => {
    const input = bookmarkCollectionSchema.parse(req.body);
    const collection = await updateCollection(req.auth!.userId, requireParam(req, "id"), input.name);
    return ok(res, collection);
  }),
);

bookmarkCollectionsRouter.delete(
  "/:id",
  asyncHandler(async (req, res) => {
    await deleteCollection(req.auth!.userId, requireParam(req, "id"));
    return ok(res, { success: true });
  }),
);
