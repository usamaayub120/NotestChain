import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../app.js";
import { prisma } from "../lib/prisma.js";
import { promoteRole, registerAndLogin, resetTestDb } from "./helpers.js";

const app = createApp();

/**
 * The push equivalent of emailNotifications.test.ts — moderation decisions
 * and comment notifications both enqueue a PushJob alongside their EmailJob,
 * in the same transaction. NEW_FOLLOWER (which has no email equivalent at
 * all) is covered in keeperProfilesAndFollows.test.ts, next to the rest of
 * the follow privacy rules it depends on.
 */
describe("push notification triggers", () => {
  afterAll(async () => {
    await resetTestDb();
    await prisma.$disconnect();
  });

  beforeEach(async () => {
    await resetTestDb();
  });

  describe("moderation decisions", () => {
    async function createPendingSubmission(authorUserId: string) {
      const draft = await prisma.draft.create({
        data: {
          userId: authorUserId,
          title: "A short thought",
          content: "Something worth keeping, maybe.",
          identityMode: "ANONYMOUS",
          discoverability: "PUBLIC",
          status: "PENDING_REVIEW",
        },
      });
      const submission = await prisma.submission.create({
        data: {
          draftId: draft.id,
          submittedByUserId: authorUserId,
          titleSnapshot: draft.title,
          contentSnapshot: draft.content,
          identityModeSnapshot: "ANONYMOUS",
          discoverabilitySnapshot: "PUBLIC",
          status: "PENDING_REVIEW",
        },
      });
      return { draft, submission };
    }

    async function moderatorAgent() {
      const moderator = await registerAndLogin(app);
      await promoteRole(moderator.userId, "MODERATOR");
      return moderator;
    }

    it("approve enqueues PUBLICATION_APPROVED addressed to the submitter, linking to the draft", async () => {
      const author = await registerAndLogin(app);
      const { draft, submission } = await createPendingSubmission(author.userId);
      const moderator = await moderatorAgent();

      const res = await moderator.agent
        .post(`/api/v1/moderation/submissions/${submission.id}/approve`)
        .set("x-csrf-token", moderator.csrfToken)
        .send({ reason: "Reads clean, nothing flagged." });
      expect(res.status).toBe(200);

      const jobs = await prisma.pushJob.findMany({ where: { userId: author.userId, kind: "PUBLICATION_APPROVED" } });
      expect(jobs).toHaveLength(1);
      const data = jobs[0]!.data as { publicationTitle: string; draftId: string };
      expect(data.publicationTitle).toBe("A short thought");
      expect(data.draftId).toBe(draft.id);
    });

    it("reject enqueues PUBLICATION_REJECTED with the moderator's reason", async () => {
      const author = await registerAndLogin(app);
      const { submission } = await createPendingSubmission(author.userId);
      const moderator = await moderatorAgent();

      await moderator.agent
        .post(`/api/v1/moderation/submissions/${submission.id}/reject`)
        .set("x-csrf-token", moderator.csrfToken)
        .send({ reason: "This repeats an earlier submission." });

      const jobs = await prisma.pushJob.findMany({ where: { userId: author.userId, kind: "PUBLICATION_REJECTED" } });
      expect(jobs).toHaveLength(1);
      expect((jobs[0]!.data as { reason: string }).reason).toBe("This repeats an earlier submission.");
    });

    it("request-changes enqueues PUBLICATION_CHANGES_REQUESTED with the reason", async () => {
      const author = await registerAndLogin(app);
      const { submission } = await createPendingSubmission(author.userId);
      const moderator = await moderatorAgent();

      await moderator.agent
        .post(`/api/v1/moderation/submissions/${submission.id}/request-changes`)
        .set("x-csrf-token", moderator.csrfToken)
        .send({ reason: "Please remove the phone number in paragraph two." });

      const jobs = await prisma.pushJob.findMany({
        where: { userId: author.userId, kind: "PUBLICATION_CHANGES_REQUESTED" },
      });
      expect(jobs).toHaveLength(1);
      expect((jobs[0]!.data as { reason: string }).reason).toBe("Please remove the phone number in paragraph two.");
    });

    it("never notifies the moderator, only the submitter", async () => {
      const author = await registerAndLogin(app);
      const { submission } = await createPendingSubmission(author.userId);
      const moderator = await moderatorAgent();

      await moderator.agent
        .post(`/api/v1/moderation/submissions/${submission.id}/approve`)
        .set("x-csrf-token", moderator.csrfToken)
        .send({ reason: "Fine." });

      const moderatorJobs = await prisma.pushJob.findMany({ where: { userId: moderator.userId, kind: "PUBLICATION_APPROVED" } });
      expect(moderatorJobs).toHaveLength(0);
    });
  });

  describe("comment notifications", () => {
    async function publishedPublication(authorUserId: string) {
      return prisma.publication.create({
        data: {
          privateAuthorUserId: authorUserId,
          identityMode: "ANONYMOUS",
          discoverability: "PUBLIC",
          title: "Kept, for now",
          content: "A thought that made it out.",
          excerpt: "A thought...",
          contentHash: "deadbeef",
          status: "PUBLISHED",
          commentsEnabled: true,
        },
      });
    }

    it("enqueues COMMENT_RECEIVED for the publication's author when someone else comments", async () => {
      const author = await registerAndLogin(app);
      const publication = await publishedPublication(author.userId);
      const commenter = await registerAndLogin(app);

      const res = await commenter.agent
        .post(`/api/v1/publications/${publication.id}/comments`)
        .set("x-csrf-token", commenter.csrfToken)
        .send({ body: "This resonated with me.", isAnonymous: true, captchaToken: "test-bypass-token" });
      expect(res.status).toBe(201);

      const jobs = await prisma.pushJob.findMany({ where: { userId: author.userId, kind: "COMMENT_RECEIVED" } });
      expect(jobs).toHaveLength(1);
      const data = jobs[0]!.data as { publicationId: string; publicationTitle: string };
      expect(data.publicationId).toBe(publication.id);
      expect(data.publicationTitle).toBe("Kept, for now");
    });

    it("does not notify when the author comments on their own publication", async () => {
      const author = await registerAndLogin(app);
      const publication = await publishedPublication(author.userId);

      const res = await author.agent
        .post(`/api/v1/publications/${publication.id}/comments`)
        .set("x-csrf-token", author.csrfToken)
        .send({ body: "Adding some context.", isAnonymous: true, captchaToken: "test-bypass-token" });
      expect(res.status).toBe(201);

      const jobs = await prisma.pushJob.findMany({ where: { kind: "COMMENT_RECEIVED" } });
      expect(jobs).toHaveLength(0);
    });
  });
});
