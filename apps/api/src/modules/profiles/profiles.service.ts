import { Discoverability } from "@noteschain/shared";
import { prisma } from "../../lib/prisma.js";
import { Errors } from "../../lib/apiError.js";
import { PUBLICLY_VISIBLE_STATUSES, toPublicationDTO } from "../publications/publications.service.js";

const COMMON_TAGS_LIMIT = 8;

async function getVisibleIdentity(username: string) {
  const identity = await prisma.publicIdentity.findUnique({ where: { username } });
  if (!identity || !identity.isVisible) {
    throw Errors.notFound("Profile not found.");
  }
  return identity;
}

function publicationWhere(identityId: string) {
  return {
    publicIdentityId: identityId,
    isPlatformVisible: true,
    discoverability: Discoverability.PUBLIC,
    status: { in: [...PUBLICLY_VISIBLE_STATUSES] },
  };
}

export async function getProfile(username: string) {
  const identity = await getVisibleIdentity(username);
  const where = publicationWhere(identity.id);

  const [publicationCount, publications] = await Promise.all([
    prisma.publication.count({ where }),
    prisma.publication.findMany({ where, select: { tags: true } }),
  ]);

  const tagFrequency = new Map<string, number>();
  for (const pub of publications) {
    for (const tag of pub.tags) {
      tagFrequency.set(tag, (tagFrequency.get(tag) ?? 0) + 1);
    }
  }
  const commonTags = [...tagFrequency.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, COMMON_TAGS_LIMIT)
    .map(([tag]) => tag);

  return {
    username: identity.username,
    displayName: identity.displayName,
    bio: identity.bio,
    avatarUrl: identity.avatarUrl,
    links: identity.links,
    type: identity.type,
    publicationCount,
    commonTags,
    joinedAt: identity.createdAt,
  };
}

export async function listProfilePublications(username: string, page: number, pageSize: number) {
  const identity = await getVisibleIdentity(username);
  const where = publicationWhere(identity.id);

  const [items, total] = await Promise.all([
    prisma.publication.findMany({
      where,
      include: { publicIdentity: true, chainRecord: true },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.publication.count({ where }),
  ]);

  return { items: items.map(toPublicationDTO), total };
}
