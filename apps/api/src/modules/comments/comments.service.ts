import type { Comment, Prisma, PublicIdentity } from "@prisma/client";
import type { CreateCommentInput } from "@noteschain/validation";
import { EmailKind, buildEmailJobData } from "@noteschain/email";
import { PushKind } from "@noteschain/push";
import { prisma } from "../../lib/prisma.js";
import { Errors } from "../../lib/apiError.js";
import { verifyCaptcha } from "../../lib/captcha.js";
import { env } from "../../config/env.js";
import { requireKeeperProfile } from "../identities/keeperProfile.service.js";
import { enqueuePush } from "../push/push.service.js";

const REPLY_INLINE_CAP = 50;

type CommentWithByline = Comment & { publicIdentity: PublicIdentity | null };

/**
 * Deliberately no "OP replied" badge here or anywhere downstream — even a
 * badge hidden only for anonymous publications would leak "no badge in
 * this thread ⇒ anonymous" as a side channel. isOwn only ever reflects the
 * requesting viewer's own comments, never the publication author's.
 *
 * The same reasoning now covers pen names: a badge shown only when the
 * commenter's byline matches the note's byline would confirm a link between
 * two identities that must otherwise stay unlinkable. Do not add one.
 */
function toCommentDTO(comment: CommentWithByline, viewerUserId: string | undefined) {
  if (!comment.isVisible) {
    return {
      id: comment.id,
      parentCommentId: comment.parentCommentId,
      rootCommentId: comment.rootCommentId,
      body: null,
      isRemoved: true,
      author: null,
      authorDisplayName: null,
      isAnonymous: false,
      isOwn: false,
      createdAt: comment.createdAt,
    };
  }

  // Legacy rows (isAnonymous, no publicIdentityId) keep rendering exactly as
  // they always have — never backfilled to a byline.
  const author = comment.publicIdentity
    ? {
        username: comment.publicIdentity.username,
        displayName: comment.publicIdentity.displayName,
        avatarUrl: comment.publicIdentity.avatarUrl,
        isPrimary: comment.publicIdentity.isPrimary,
      }
    : null;

  return {
    id: comment.id,
    parentCommentId: comment.parentCommentId,
    rootCommentId: comment.rootCommentId,
    body: comment.body,
    isRemoved: false,
    author,
    authorDisplayName: comment.isAnonymous ? "Anonymous" : (author?.displayName ?? comment.authorDisplayNameSnapshot),
    isAnonymous: comment.isAnonymous,
    isOwn: viewerUserId !== undefined && viewerUserId === comment.authorUserId,
    createdAt: comment.createdAt,
  };
}

async function assertCommentable(publicationId: string) {
  const publication = await prisma.publication.findUnique({ where: { id: publicationId } });
  if (!publication || !publication.isPlatformVisible) {
    throw Errors.notFound("Publication not found.");
  }
  return publication;
}

export async function listTopLevelComments(
  publicationId: string,
  page: number,
  pageSize: number,
  viewerUserId: string | undefined,
) {
  await assertCommentable(publicationId);

  const where = { publicationId, parentCommentId: null };
  const [items, total] = await Promise.all([
    prisma.comment.findMany({
      where,
      include: { publicIdentity: true },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.comment.count({ where }),
  ]);

  const withReplies = await Promise.all(
    items.map(async (top) => {
      const [replies, repliesTotal] = await Promise.all([
        prisma.comment.findMany({
          where: { rootCommentId: top.id },
          include: { publicIdentity: true },
          orderBy: { createdAt: "asc" },
          take: REPLY_INLINE_CAP,
        }),
        prisma.comment.count({ where: { rootCommentId: top.id } }),
      ]);
      return {
        ...toCommentDTO(top, viewerUserId),
        replies: replies.map((r) => toCommentDTO(r, viewerUserId)),
        repliesTotal,
        repliesTruncated: repliesTotal > REPLY_INLINE_CAP,
      };
    }),
  );

  return { items: withReplies, total };
}

export async function listReplies(rootCommentId: string, page: number, pageSize: number, viewerUserId: string | undefined) {
  const where = { rootCommentId };
  const [items, total] = await Promise.all([
    prisma.comment.findMany({
      where,
      include: { publicIdentity: true },
      orderBy: { createdAt: "asc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.comment.count({ where }),
  ]);

  return { items: items.map((c) => toCommentDTO(c, viewerUserId)), total };
}

/**
 * Resolves which byline a new comment is posted under.
 *
 * `publicIdentityId` is the current, preferred shape — any identity the
 * commenter owns, Keeper profile or pen name. The legacy `isAnonymous` shape
 * is still honored for an already-installed mobile binary: `false` becomes
 * the commenter's Keeper profile, and `true` stays genuinely anonymous only
 * while ALLOW_ANONYMOUS_POSTING is on (see AGENTS.md's ship-order note on
 * closing this door once client adoption is high enough).
 */
async function resolveCommentByline(
  authorUserId: string,
  input: CreateCommentInput,
): Promise<{ publicIdentityId: string | null; isAnonymous: boolean; legacyDisplayName: string | null }> {
  if (input.publicIdentityId) {
    const identity = await prisma.publicIdentity.findUnique({ where: { id: input.publicIdentityId } });
    if (!identity || identity.userId !== authorUserId) {
      throw Errors.badRequest("Selected byline does not belong to you.");
    }
    return { publicIdentityId: identity.id, isAnonymous: false, legacyDisplayName: null };
  }

  if (input.isAnonymous === true) {
    if (!env.ALLOW_ANONYMOUS_POSTING) {
      throw Errors.badRequest("Comment under your Keeper profile or a pen name.");
    }
    return { publicIdentityId: null, isAnonymous: true, legacyDisplayName: input.displayName ?? null };
  }

  // No byline specified and not explicitly anonymous: an older client's
  // "post with account" path. Default to the commenter's own profile rather
  // than rejecting a request that used to work.
  const keeperProfile = await requireKeeperProfile(authorUserId);
  return { publicIdentityId: keeperProfile.id, isAnonymous: false, legacyDisplayName: null };
}

export async function createComment(publicationId: string, authorUserId: string, input: CreateCommentInput) {
  const publication = await assertCommentable(publicationId);
  if (publication.status !== "PUBLISHED") throw Errors.notFound("Publication not found.");
  if (!publication.commentsEnabled) throw Errors.forbidden("Comments are disabled for this publication.");

  let rootCommentId: string | null = null;
  if (input.parentCommentId) {
    const parentComment = await prisma.comment.findUnique({ where: { id: input.parentCommentId } });
    if (!parentComment || parentComment.publicationId !== publicationId) {
      throw Errors.notFound("Comment not found.");
    }
    rootCommentId = parentComment.rootCommentId ?? parentComment.id;
  }

  const captchaOk = await verifyCaptcha(input.captchaToken);
  if (!captchaOk) throw Errors.badRequest("Captcha verification failed. Please try again.");

  const byline = await resolveCommentByline(authorUserId, input);

  let authorDisplayNameSnapshot: string | null = byline.legacyDisplayName;
  if (byline.publicIdentityId) {
    const identity = await prisma.publicIdentity.findUniqueOrThrow({ where: { id: byline.publicIdentityId } });
    // Snapshotted, not a live join — a later name change doesn't retroactively
    // relabel past comments, same rule as the old commentDisplayName snapshot.
    authorDisplayNameSnapshot = identity.displayName;
  }

  // Only the anonymity the COMMENTER chose is reflected here — never
  // whether the recipient (the publication's author) is anonymous, which
  // stays completely outside this notification.
  const commenterName = authorDisplayNameSnapshot ?? "Someone";
  const notifyAuthor = publication.privateAuthorUserId !== authorUserId;

  const comment = await prisma.$transaction(async (tx) => {
    const created = await tx.comment.create({
      data: {
        publicationId,
        parentCommentId: input.parentCommentId,
        rootCommentId,
        authorUserId,
        publicIdentityId: byline.publicIdentityId,
        isAnonymous: byline.isAnonymous,
        authorDisplayNameSnapshot,
        body: input.body,
      },
      include: { publicIdentity: true },
    });

    if (notifyAuthor) {
      const author = await tx.user.findUnique({ where: { id: publication.privateAuthorUserId }, select: { email: true } });
      if (author) {
        const emailData = buildEmailJobData(EmailKind.COMMENT_RECEIVED, {
          publicationTitle: publication.title,
          publicationUrl: `${env.PUBLIC_WEB_ORIGIN}/p/${publicationId}`,
          commenterName,
          commentBody: input.body,
        });
        await tx.emailJob.create({
          data: {
            kind: EmailKind.COMMENT_RECEIVED,
            toEmail: author.email,
            toUserId: publication.privateAuthorUserId,
            data: emailData as Prisma.InputJsonValue,
          },
        });
        await enqueuePush(tx, publication.privateAuthorUserId, PushKind.COMMENT_RECEIVED, {
          publicationId,
          publicationTitle: publication.title,
          commenterName,
        });
      }
    }

    return created;
  });

  return toCommentDTO(comment, authorUserId);
}

export async function deleteComment(commentId: string, userId: string) {
  const comment = await prisma.comment.findUnique({ where: { id: commentId } });
  // notFound, not forbidden — a stranger shouldn't be able to tell "doesn't
  // exist" apart from "exists but isn't yours" (same rationale as reports).
  if (!comment || !comment.isVisible || comment.authorUserId !== userId) {
    throw Errors.notFound("Comment not found.");
  }

  await prisma.comment.update({
    where: { id: commentId },
    data: { isVisible: false, removalReason: "Removed by author." },
  });
}

export async function createCommentReport(commentId: string, reporterUserId: string, reason: string) {
  const comment = await prisma.comment.findUnique({ where: { id: commentId } });
  if (!comment || !comment.isVisible) throw Errors.notFound("Comment not found.");
  return prisma.commentReport.create({ data: { commentId, reporterUserId, reason } });
}

export async function setCommentsEnabled(publicationId: string, userId: string, enabled: boolean) {
  const publication = await assertCommentable(publicationId);
  if (publication.privateAuthorUserId !== userId) throw Errors.notFound("Publication not found.");

  return prisma.publication.update({
    where: { id: publicationId },
    data: { commentsEnabled: enabled },
  });
}
