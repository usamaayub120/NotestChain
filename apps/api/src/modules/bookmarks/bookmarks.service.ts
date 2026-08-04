import { prisma } from "../../lib/prisma.js";
import { Errors } from "../../lib/apiError.js";
import { toPublicationDTO } from "../publications/publications.service.js";

export async function listBookmarks(userId: string) {
  const bookmarks = await prisma.bookmark.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    include: { publication: { include: { publicIdentity: true, chainRecord: true } }, collection: true },
  });
  return bookmarks.map((b) => ({
    id: b.id,
    createdAt: b.createdAt,
    collectionId: b.collectionId,
    collectionName: b.collection?.name ?? null,
    publication: toPublicationDTO(b.publication),
  }));
}

export async function createBookmark(userId: string, publicationId: string, collectionId?: string | null) {
  const publication = await prisma.publication.findUnique({ where: { id: publicationId } });
  if (!publication || !publication.isPlatformVisible) {
    throw Errors.notFound("Publication not found.");
  }

  if (collectionId) {
    const collection = await prisma.bookmarkCollection.findUnique({ where: { id: collectionId } });
    if (!collection || collection.userId !== userId) {
      throw Errors.badRequest("That collection does not belong to you.");
    }
  }

  return prisma.bookmark.upsert({
    where: { userId_publicationId: { userId, publicationId } },
    update: { collectionId: collectionId ?? null },
    create: { userId, publicationId, collectionId: collectionId ?? null },
  });
}

export async function removeBookmark(userId: string, publicationId: string) {
  await prisma.bookmark.deleteMany({ where: { userId, publicationId } });
}

export async function listCollections(userId: string) {
  return prisma.bookmarkCollection.findMany({ where: { userId }, orderBy: { createdAt: "asc" } });
}

export async function createCollection(userId: string, name: string) {
  const existing = await prisma.bookmarkCollection.findUnique({ where: { userId_name: { userId, name } } });
  if (existing) throw Errors.conflict("You already have a collection with that name.");
  return prisma.bookmarkCollection.create({ data: { userId, name } });
}

async function getOwnedCollectionOrThrow(userId: string, collectionId: string) {
  const collection = await prisma.bookmarkCollection.findUnique({ where: { id: collectionId } });
  if (!collection) throw Errors.notFound("Collection not found.");
  if (collection.userId !== userId) throw Errors.forbidden("You do not own this collection.");
  return collection;
}

export async function updateCollection(userId: string, collectionId: string, name: string) {
  await getOwnedCollectionOrThrow(userId, collectionId);
  return prisma.bookmarkCollection.update({ where: { id: collectionId }, data: { name } });
}

export async function deleteCollection(userId: string, collectionId: string) {
  await getOwnedCollectionOrThrow(userId, collectionId);
  await prisma.bookmarkCollection.delete({ where: { id: collectionId } });
}
