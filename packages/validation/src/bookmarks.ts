import { z } from "zod";

export const createBookmarkSchema = z.object({
  publicationId: z.string().uuid(),
  collectionId: z.string().uuid().optional().nullable(),
});
export type CreateBookmarkInput = z.infer<typeof createBookmarkSchema>;

export const bookmarkCollectionSchema = z.object({
  name: z.string().trim().min(1).max(60),
});
export type BookmarkCollectionInput = z.infer<typeof bookmarkCollectionSchema>;
