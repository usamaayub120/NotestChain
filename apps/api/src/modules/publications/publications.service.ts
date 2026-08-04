import type { Publication, PublicationChainRecord, PublicIdentity } from "@prisma/client";
import { Discoverability, IdentityMode } from "@noteschain/shared";
import { prisma } from "../../lib/prisma.js";
import { Errors } from "../../lib/apiError.js";
import { env } from "../../config/env.js";

type PublicationWithRelations = Publication & {
  publicIdentity: PublicIdentity | null;
  chainRecord: PublicationChainRecord | null;
};

// The Phase 2 read model intentionally shows CHAIN_PENDING/CHAIN_SUBMITTED
// publications too (not just PUBLISHED) so the platform is fully usable
// before the worker (Phase 4) exists — every response carries an explicit
// chainStatus so the UI never has to guess or overclaim. Search (§16 of the
// product spec) is the one place required to be finalized-only; see
// search.service.ts.
export const PUBLICLY_VISIBLE_STATUSES = ["CHAIN_PENDING", "CHAIN_SUBMITTED", "PUBLISHED"] as const;

/**
 * Never includes privateAuthorUserId, sourceDraftId, or any moderation
 * metadata — this is the shape returned to unauthenticated visitors.
 */
export function toPublicationDTO(pub: PublicationWithRelations) {
  const author =
    pub.identityMode === IdentityMode.ANONYMOUS || !pub.publicIdentity
      ? null
      : {
          username: pub.publicIdentity.username,
          displayName: pub.publicIdentity.displayName,
          avatarUrl: pub.publicIdentity.avatarUrl,
          type: pub.publicIdentity.type,
        };

  const chain = pub.chainRecord;
  return {
    id: pub.id,
    title: pub.title,
    content: pub.content,
    excerpt: pub.excerpt,
    tags: pub.tags,
    identityMode: pub.identityMode,
    discoverability: pub.discoverability,
    author,
    status: pub.status,
    previousPublicationId: pub.previousPublicationId,
    publishedAt: pub.publishedAt,
    createdAt: pub.createdAt,
    chain: chain
      ? {
          status: chain.chainStatus,
          network: chain.network,
          publicationPda: chain.publicationPda,
          transactionSignature: chain.transactionSignature,
          explorerUrl: chain.transactionSignature
            ? `${env.PUBLIC_EXPLORER_BASE_URL}/tx/${chain.transactionSignature}?cluster=${chain.network}`
            : null,
        }
      : null,
  };
}

const publicationInclude = { publicIdentity: true, chainRecord: true } as const;

export interface ListPublicationsOptions {
  page: number;
  pageSize: number;
  tag?: string;
}

export async function listPublicPublications(options: ListPublicationsOptions) {
  const where = {
    isPlatformVisible: true,
    discoverability: Discoverability.PUBLIC,
    status: { in: [...PUBLICLY_VISIBLE_STATUSES] },
    ...(options.tag ? { tags: { has: options.tag } } : {}),
  };

  const [items, total] = await Promise.all([
    prisma.publication.findMany({
      where,
      include: publicationInclude,
      orderBy: { createdAt: "desc" },
      skip: (options.page - 1) * options.pageSize,
      take: options.pageSize,
    }),
    prisma.publication.count({ where }),
  ]);

  return { items: items.map(toPublicationDTO), total };
}

/**
 * Direct-link access: an UNLISTED-but-visible publication is reachable here
 * even though it's excluded from listPublicPublications — "unlisted" means
 * "not discoverable," never "not accessible by URL" (product spec §8).
 */
export async function getPublicationById(id: string) {
  const pub = await prisma.publication.findUnique({ where: { id }, include: publicationInclude });
  if (!pub || !pub.isPlatformVisible) {
    throw Errors.notFound("Publication not found.");
  }
  return toPublicationDTO(pub);
}

export async function getPublicationRevisions(id: string) {
  const pub = await prisma.publication.findUnique({ where: { id } });
  if (!pub || !pub.isPlatformVisible) {
    throw Errors.notFound("Publication not found.");
  }

  const [previous, revisions] = await Promise.all([
    pub.previousPublicationId
      ? prisma.publication.findUnique({
          where: { id: pub.previousPublicationId },
          include: publicationInclude,
        })
      : null,
    prisma.publication.findMany({
      where: { previousPublicationId: id, isPlatformVisible: true },
      include: publicationInclude,
      orderBy: { createdAt: "asc" },
    }),
  ]);

  return {
    previous: previous ? toPublicationDTO(previous) : null,
    revisions: revisions.map(toPublicationDTO),
  };
}
