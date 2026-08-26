import { Discoverability } from "@noteschain/shared";
import { prisma } from "../../lib/prisma.js";
import { Errors } from "../../lib/apiError.js";
import { PUBLICLY_VISIBLE_STATUSES, toPublicationDTO } from "../publications/publications.service.js";
import { followerCountFor, isFollowing } from "../follows/follows.service.js";

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

/**
 * The publicly visible half of the opt-in fields — birth date and gender are
 * stored whenever the owner filled them in, but only leave this function when
 * their matching show* flag is on. Filling a field in is not the same as
 * publishing it, so there is no "owner view" shortcut here: this is the one
 * function every visitor's response goes through, owner included.
 */
function toPublicProfileFields(identity: {
  birthDate: Date | null;
  showBirthDate: boolean;
  gender: string | null;
  showGender: boolean;
}) {
  return {
    birthDate: identity.showBirthDate ? identity.birthDate : null,
    gender: identity.showGender ? identity.gender : null,
  };
}

export async function getProfile(username: string, viewerUserId?: string) {
  const identity = await getVisibleIdentity(username);
  const where = publicationWhere(identity.id);

  const [publicationCount, publications, followerCount, viewerIsFollowing] = await Promise.all([
    prisma.publication.count({ where }),
    prisma.publication.findMany({ where, select: { tags: true } }),
    followerCountFor(identity.id),
    isFollowing(viewerUserId, identity.id),
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
    location: identity.location,
    pronouns: identity.pronouns,
    ...toPublicProfileFields(identity),
    type: identity.type,
    // Tells the client whether this is the Keeper's own profile or a pen
    // name — the byline "kind" label the note page and search results share.
    isPrimary: identity.isPrimary,
    publicationCount,
    commonTags,
    joinedAt: identity.createdAt,
    // null below the visibility threshold; see follows.service.ts. The
    // client renders that as "New", never as zero.
    followerCount,
    isFollowing: viewerIsFollowing,
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

  return { items: items.map((pub) => toPublicationDTO(pub)), total };
}
