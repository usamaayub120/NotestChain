import type { CreateIdentityInput, UpdateIdentityInput } from "@noteschain/validation";
import { prisma } from "../../lib/prisma.js";
import { Errors } from "../../lib/apiError.js";

export function toIdentityDTO(identity: {
  id: string;
  type: string;
  username: string;
  displayName: string;
  bio: string;
  avatarUrl: string | null;
  links: string[];
  isVisible: boolean;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    id: identity.id,
    type: identity.type,
    username: identity.username,
    displayName: identity.displayName,
    bio: identity.bio,
    avatarUrl: identity.avatarUrl,
    links: identity.links,
    isVisible: identity.isVisible,
    createdAt: identity.createdAt,
    updatedAt: identity.updatedAt,
  };
}

export async function listIdentitiesForUser(userId: string) {
  return prisma.publicIdentity.findMany({ where: { userId }, orderBy: { createdAt: "asc" } });
}

export async function createIdentity(userId: string, input: CreateIdentityInput) {
  const existing = await prisma.publicIdentity.findUnique({ where: { username: input.username } });
  if (existing) {
    throw Errors.conflict("That username is already taken.");
  }
  return prisma.publicIdentity.create({
    data: {
      userId,
      type: input.type,
      username: input.username,
      displayName: input.displayName,
      bio: input.bio ?? "",
      avatarUrl: input.avatarUrl ?? null,
      links: input.links ?? [],
      isVisible: input.isVisible ?? true,
    },
  });
}

async function getOwnedIdentityOrThrow(userId: string, identityId: string) {
  const identity = await prisma.publicIdentity.findUnique({ where: { id: identityId } });
  if (!identity) throw Errors.notFound("Identity not found.");
  if (identity.userId !== userId) throw Errors.forbidden("You do not own this identity.");
  return identity;
}

export async function getIdentity(userId: string, identityId: string) {
  return getOwnedIdentityOrThrow(userId, identityId);
}

export async function updateIdentity(userId: string, identityId: string, input: UpdateIdentityInput) {
  await getOwnedIdentityOrThrow(userId, identityId);
  return prisma.publicIdentity.update({
    where: { id: identityId },
    data: {
      displayName: input.displayName,
      bio: input.bio,
      avatarUrl: input.avatarUrl,
      links: input.links,
      isVisible: input.isVisible,
    },
  });
}

export async function deleteIdentity(userId: string, identityId: string) {
  await getOwnedIdentityOrThrow(userId, identityId);

  const publicationCount = await prisma.publication.count({ where: { publicIdentityId: identityId } });
  if (publicationCount > 0) {
    // Never delete an identity that already has attributed publications —
    // it would break attribution on immutable, already-finalized content.
    // Hiding it is the safe equivalent of "delete" for a published identity.
    return prisma.publicIdentity.update({ where: { id: identityId }, data: { isVisible: false } });
  }

  const draftCount = await prisma.draft.count({ where: { publicIdentityId: identityId } });
  if (draftCount > 0) {
    throw Errors.badRequest(
      "This identity is used by one or more drafts. Change their identity first, or delete those drafts.",
    );
  }

  await prisma.publicIdentity.delete({ where: { id: identityId } });
}
