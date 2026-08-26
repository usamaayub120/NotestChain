import { Prisma } from "@prisma/client";
import type { ChangeUsernameInput, CreateIdentityInput, UpdateIdentityInput } from "@noteschain/validation";
import { IdentityType } from "@noteschain/shared";
import { prisma } from "../../lib/prisma.js";
import { Errors } from "../../lib/apiError.js";
import { resolveUsername } from "./keeperProfile.service.js";

type IdentityRow = {
  id: string;
  type: string;
  isPrimary: boolean;
  username: string;
  displayName: string;
  bio: string;
  avatarUrl: string | null;
  links: string[];
  location: string | null;
  pronouns: string | null;
  birthDate: Date | null;
  showBirthDate: boolean;
  gender: string | null;
  showGender: boolean;
  usernameChangedAt: Date | null;
  isVisible: boolean;
  createdAt: Date;
  updatedAt: Date;
};

/**
 * The owner's view of one of their own bylines, so it includes the private
 * values of the opt-in fields. The *public* projection lives in
 * profiles.service.ts and must not reuse this — it applies the show* gates.
 *
 * Note what is absent and must stay absent: `userId`. Nothing public may ever
 * carry it, because it is what links two pen names to the same person.
 */
export function toIdentityDTO(identity: IdentityRow) {
  return {
    id: identity.id,
    type: identity.type,
    isPrimary: identity.isPrimary,
    username: identity.username,
    displayName: identity.displayName,
    bio: identity.bio,
    avatarUrl: identity.avatarUrl,
    links: identity.links,
    location: identity.location,
    pronouns: identity.pronouns,
    birthDate: identity.birthDate,
    showBirthDate: identity.showBirthDate,
    gender: identity.gender,
    showGender: identity.showGender,
    // Null means the handle was generated for them and one free rename is
    // still owed. The client uses this to decide whether to offer it.
    canChangeUsername: identity.isPrimary && identity.usernameChangedAt === null,
    isVisible: identity.isVisible,
    createdAt: identity.createdAt,
    updatedAt: identity.updatedAt,
  };
}

/** Keeper profile first, then pen names oldest-first. */
export async function listIdentitiesForUser(userId: string) {
  return prisma.publicIdentity.findMany({
    where: { userId },
    orderBy: [{ isPrimary: "desc" }, { createdAt: "asc" }],
  });
}

export async function createIdentity(userId: string, input: CreateIdentityInput) {
  try {
    return await prisma.publicIdentity.create({
      data: {
        userId,
        // Only registration creates a REAL_NAME byline, and only as the
        // Keeper profile. Everything made here is a pen name.
        type: IdentityType.PSEUDONYM,
        isPrimary: false,
        username: input.username,
        displayName: input.displayName,
        bio: input.bio ?? "",
        avatarUrl: input.avatarUrl ?? null,
        links: input.links ?? [],
        location: input.location ?? null,
        pronouns: input.pronouns ?? null,
        birthDate: input.birthDate ?? null,
        showBirthDate: input.showBirthDate ?? false,
        gender: input.gender ?? null,
        showGender: input.showGender ?? false,
        isVisible: input.isVisible ?? true,
      },
    });
  } catch (error) {
    // The unique constraint is the real guard, not a prior findUnique — a
    // read-then-write check races two simultaneous signups to the same handle.
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      throw Errors.conflict("That username is already taken.");
    }
    throw error;
  }
}

async function getOwnedIdentityOrThrow(userId: string, identityId: string) {
  const identity = await prisma.publicIdentity.findUnique({ where: { id: identityId } });
  // notFound rather than forbidden for someone else's identity: a 403 here
  // would confirm that an id exists, which is exactly the kind of oracle the
  // rest of this module is built to avoid.
  if (!identity || identity.userId !== userId) throw Errors.notFound("Identity not found.");
  return identity;
}

export async function getIdentity(userId: string, identityId: string) {
  return getOwnedIdentityOrThrow(userId, identityId);
}

export async function updateIdentity(userId: string, identityId: string, input: UpdateIdentityInput) {
  const identity = await getOwnedIdentityOrThrow(userId, identityId);

  // The Keeper profile is how a person is found. It cannot be hidden, and it
  // cannot be deleted (see below) — pen names are the private option.
  if (identity.isPrimary && input.isVisible === false) {
    throw Errors.badRequest("Your Keeper profile is always visible. Use a pen name to publish more privately.");
  }

  return prisma.publicIdentity.update({
    where: { id: identityId },
    data: {
      displayName: input.displayName,
      bio: input.bio,
      avatarUrl: input.avatarUrl,
      links: input.links,
      location: input.location,
      pronouns: input.pronouns,
      birthDate: input.birthDate,
      showBirthDate: input.showBirthDate,
      gender: input.gender,
      showGender: input.showGender,
      isVisible: identity.isPrimary ? undefined : input.isVisible,
    },
  });
}

/**
 * The single rename a Keeper is owed when the backfill generated their handle
 * for them. Once used it is permanent: a handle that has appeared on a byline
 * or in someone's follow list should not keep moving.
 */
export async function changeKeeperUsername(userId: string, input: ChangeUsernameInput) {
  const identity = await prisma.publicIdentity.findFirst({ where: { userId, isPrimary: true } });
  if (!identity) throw Errors.notFound("Keeper profile not found.");
  if (identity.usernameChangedAt !== null) {
    throw Errors.badRequest("Your username has already been set and cannot be changed again.");
  }
  if (input.username === identity.username) return identity;

  await resolveUsername(prisma, { chosen: input.username });
  try {
    return await prisma.publicIdentity.update({
      where: { id: identity.id },
      data: { username: input.username, usernameChangedAt: new Date() },
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      throw Errors.conflict("That username is already taken.");
    }
    throw error;
  }
}

export async function deleteIdentity(userId: string, identityId: string) {
  const identity = await getOwnedIdentityOrThrow(userId, identityId);

  if (identity.isPrimary) {
    throw Errors.badRequest("Your Keeper profile can't be deleted. Delete your account instead.");
  }

  const [publicationCount, commentCount] = await Promise.all([
    prisma.publication.count({ where: { publicIdentityId: identityId } }),
    prisma.comment.count({ where: { publicIdentityId: identityId } }),
  ]);

  if (publicationCount > 0 || commentCount > 0) {
    // Never delete a byline that has already been shown to readers — it would
    // break attribution on immutable published notes and on public comments.
    // Hiding it is the safe equivalent of "delete" for a used byline.
    return prisma.publicIdentity.update({ where: { id: identityId }, data: { isVisible: false } });
  }

  const draftCount = await prisma.draft.count({ where: { publicIdentityId: identityId } });
  if (draftCount > 0) {
    throw Errors.badRequest(
      "This pen name is used by one or more drafts. Change their byline first, or delete those drafts.",
    );
  }

  await prisma.publicIdentity.delete({ where: { id: identityId } });
}
