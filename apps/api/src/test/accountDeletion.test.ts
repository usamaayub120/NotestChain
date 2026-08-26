import request from "supertest";
import { beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../app.js";
import { prisma } from "../lib/prisma.js";
import { registerAndLogin, resetTestDb } from "./helpers.js";

const app = createApp();
const PASSWORD = "a-strong-test-password-1";

describe("self-service account deletion", () => {
  beforeEach(resetTestDb);

  it("rejects the wrong password and leaves the account untouched", async () => {
    const { agent, csrfToken, userId } = await registerAndLogin(app);

    const res = await agent
      .delete("/api/v1/auth/account")
      .set("x-csrf-token", csrfToken)
      .send({ password: "not-the-password" });

    expect(res.status).toBe(401);
    const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
    expect(user.status).toBe("ACTIVE");
  });

  it("scrubs credentials, revokes sessions, preserves published content, and prunes what doesn't need to survive", async () => {
    const { agent, csrfToken, userId } = await registerAndLogin(app, PASSWORD);
    const originalUser = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
    const originalEmail = originalUser.email;

    // An identity that already has a publication — must survive, hidden.
    const attributedIdentity = await prisma.publicIdentity.create({
      data: { userId, type: "PSEUDONYM", username: "kept-writer", displayName: "Kept Writer" },
    });
    // An identity with nothing published under it — nothing anchors it.
    const unusedIdentity = await prisma.publicIdentity.create({
      data: { userId, type: "PSEUDONYM", username: "unused-byline", displayName: "Unused Byline" },
    });

    const publishedDraft = await prisma.draft.create({
      data: { userId, title: "A kept thought", status: "PUBLISHED", publicIdentityId: attributedIdentity.id },
    });
    await prisma.publication.create({
      data: {
        sourceDraftId: publishedDraft.id,
        privateAuthorUserId: userId,
        publicIdentityId: attributedIdentity.id,
        identityMode: "PSEUDONYMOUS",
        discoverability: "PUBLIC",
        title: "A kept thought",
        content: "This stays exactly as published.",
        excerpt: "This stays...",
        contentHash: "feedface",
        status: "PUBLISHED",
      },
    });
    const unpublishedDraft = await prisma.draft.create({
      data: { userId, title: "Never finished", status: "DRAFT" },
    });

    const res = await agent
      .delete("/api/v1/auth/account")
      .set("x-csrf-token", csrfToken)
      .send({ password: PASSWORD });
    expect(res.status).toBe(200);
    expect(res.body.data.success).toBe(true);

    const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
    expect(user.status).toBe("DELETED");
    expect(user.email).not.toBe(originalEmail);
    expect(user.email).toBe(`deleted-${userId}@noteschain.invalid`);
    expect(user.passwordHash).not.toBe(originalUser.passwordHash);
    expect(user.commentDisplayName).toBeNull();

    const identities = await prisma.publicIdentity.findMany({ where: { userId } });
    expect(identities).toHaveLength(1);
    expect(identities[0]!.id).toBe(attributedIdentity.id);
    expect(identities[0]!.isVisible).toBe(false);
    await expect(prisma.publicIdentity.findUnique({ where: { id: unusedIdentity.id } })).resolves.toBeNull();

    const remainingDrafts = await prisma.draft.findMany({ where: { userId } });
    expect(remainingDrafts).toHaveLength(1);
    expect(remainingDrafts[0]!.id).toBe(publishedDraft.id);
    await expect(prisma.draft.findUnique({ where: { id: unpublishedDraft.id } })).resolves.toBeNull();

    const publication = await prisma.publication.findFirst({ where: { sourceDraftId: publishedDraft.id } });
    expect(publication?.title).toBe("A kept thought");
    expect(publication?.content).toBe("This stays exactly as published.");

    const welcomeEmailJob = await prisma.emailJob.findFirst({ where: { toUserId: userId } });
    expect(welcomeEmailJob?.toEmail).toBe(`deleted-${userId}@noteschain.invalid`);

    const meAfter = await agent.get("/api/v1/auth/me");
    expect(meAfter.status).toBe(401);

    const loginAfter = await request(app)
      .post("/api/v1/auth/login")
      .send({ email: originalEmail, password: PASSWORD });
    expect(loginAfter.status).toBe(401);
  });

  it("scrubs the new profile fields, drops follows in both directions, and keeps a comment-only byline (never the follower list)", async () => {
    const { agent, csrfToken, userId } = await registerAndLogin(app, PASSWORD);

    const attributedIdentity = await prisma.publicIdentity.create({
      data: {
        userId,
        type: "PSEUDONYM",
        username: "personal-details",
        displayName: "Personal Details",
        bio: "A short bio.",
        avatarUrl: "https://example.com/avatar.png",
        links: ["https://example.com"],
        location: "Nowhere in particular",
        pronouns: "they/them",
        birthDate: new Date("1990-01-01"),
        showBirthDate: true,
        gender: "unspecified",
        showGender: true,
      },
    });
    await prisma.publication.create({
      data: {
        privateAuthorUserId: userId,
        publicIdentityId: attributedIdentity.id,
        identityMode: "PSEUDONYMOUS",
        discoverability: "PUBLIC",
        title: "Kept",
        content: "Stays.",
        excerpt: "Stays.",
        contentHash: "aa11bb22",
        status: "PUBLISHED",
      },
    });

    // An identity with a comment but no publication — commentCount alone
    // must be enough to hide-not-delete, same as publicationCount.
    const commentOnlyIdentity = await prisma.publicIdentity.create({
      data: { userId, type: "PSEUDONYM", username: "commenter-only", displayName: "Commenter Only" },
    });
    const otherAuthor = await registerAndLogin(app);
    const otherPublication = await prisma.publication.create({
      data: {
        privateAuthorUserId: otherAuthor.userId,
        identityMode: "ANONYMOUS",
        discoverability: "PUBLIC",
        title: "Someone else's note",
        content: "Not this account's.",
        excerpt: "Not this...",
        contentHash: "cc33dd44",
        status: "PUBLISHED",
      },
    });
    await prisma.comment.create({
      data: {
        publicationId: otherPublication.id,
        authorUserId: userId,
        publicIdentityId: commentOnlyIdentity.id,
        authorDisplayNameSnapshot: commentOnlyIdentity.displayName,
        body: "A comment that outlives the account.",
      },
    });

    // Follows in both directions: this account follows someone, and someone
    // follows this account's byline. Both must be gone afterward.
    const followedByMe = await registerAndLogin(app);
    const followedByMeIdentity = await prisma.publicIdentity.findFirstOrThrow({
      where: { userId: followedByMe.userId, isPrimary: true },
    });
    await prisma.follow.create({ data: { followerUserId: userId, targetIdentityId: followedByMeIdentity.id } });

    const someFollower = await registerAndLogin(app);
    await prisma.follow.create({ data: { followerUserId: someFollower.userId, targetIdentityId: attributedIdentity.id } });

    // A registered device, and something already queued to reach it.
    await prisma.pushToken.create({ data: { userId, token: "device-token-1", platform: "ANDROID" } });
    await prisma.pushJob.create({
      data: { userId, kind: "NEW_FOLLOWER", data: { followerUsername: "x", followerDisplayName: "X", targetUsername: "y", targetDisplayName: "Y" } },
    });

    const res = await agent.delete("/api/v1/auth/account").set("x-csrf-token", csrfToken).send({ password: PASSWORD });
    expect(res.status).toBe(200);

    const scrubbed = await prisma.publicIdentity.findUniqueOrThrow({ where: { id: attributedIdentity.id } });
    expect(scrubbed.isVisible).toBe(false);
    expect(scrubbed.bio).toBe("");
    expect(scrubbed.avatarUrl).toBeNull();
    expect(scrubbed.links).toEqual([]);
    expect(scrubbed.location).toBeNull();
    expect(scrubbed.pronouns).toBeNull();
    expect(scrubbed.birthDate).toBeNull();
    expect(scrubbed.showBirthDate).toBe(false);
    expect(scrubbed.gender).toBeNull();
    expect(scrubbed.showGender).toBe(false);
    // The byline text itself survives — it's already public on the note.
    expect(scrubbed.displayName).toBe("Personal Details");
    expect(scrubbed.username).toBe("personal-details");

    const survivingComment = await prisma.comment.findFirst({ where: { publicIdentityId: commentOnlyIdentity.id } });
    expect(survivingComment).not.toBeNull();
    await expect(prisma.publicIdentity.findUniqueOrThrow({ where: { id: commentOnlyIdentity.id } })).resolves.toMatchObject({
      isVisible: false,
    });

    await expect(prisma.follow.findMany({ where: { followerUserId: userId } })).resolves.toHaveLength(0);
    await expect(prisma.follow.findMany({ where: { targetIdentityId: attributedIdentity.id } })).resolves.toHaveLength(0);
    await expect(
      prisma.follow.findFirst({ where: { followerUserId: someFollower.userId, targetIdentityId: attributedIdentity.id } }),
    ).resolves.toBeNull();

    await expect(prisma.pushToken.findMany({ where: { userId } })).resolves.toHaveLength(0);
    await expect(prisma.pushJob.findMany({ where: { userId } })).resolves.toHaveLength(0);
  });
});
