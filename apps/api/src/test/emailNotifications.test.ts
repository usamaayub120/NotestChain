import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../app.js";
import { prisma } from "../lib/prisma.js";
import { promoteRole, registerAndLogin, resetTestDb } from "./helpers.js";

const app = createApp();

/**
 * Every transactional email trigger wired into the API — moderation
 * decisions, signup, and comment notifications — goes through EmailJob. This
 * asserts each one enqueues exactly the row it should, with a payload that
 * satisfies the kind's own zod schema, rather than trusting that a call
 * compiles and calling it done.
 */
describe("email notification triggers", () => {
  afterAll(async () => {
    await resetTestDb();
    await prisma.$disconnect();
  });

  beforeEach(async () => {
    await resetTestDb();
  });

  it("enqueues an ACCOUNT_WELCOME job on signup, addressed to the new user", async () => {
    const { userId } = await registerAndLogin(app);

    const jobs = await prisma.emailJob.findMany({ where: { toUserId: userId } });
    expect(jobs).toHaveLength(1);
    expect(jobs[0]).toMatchObject({ kind: "ACCOUNT_WELCOME", status: "PENDING" });
    expect((jobs[0]!.data as Record<string, unknown>).startWritingUrl).toMatch(/^https?:\/\//);
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

      const jobs = await prisma.emailJob.findMany({ where: { toUserId: author.userId, kind: "PUBLICATION_APPROVED" } });
      expect(jobs).toHaveLength(1);
      const data = jobs[0]!.data as { publicationTitle: string; draftEditUrl: string };
      expect(data.publicationTitle).toBe("A short thought");
      expect(data.draftEditUrl).toContain(draft.id);
      // The moderator's reason is an internal audit note here, not
      // congratulatory-email content — it must not leak into the payload.
      expect(JSON.stringify(data)).not.toContain("Reads clean");
    });

    it("reject enqueues PUBLICATION_REJECTED with the moderator's reason quoted", async () => {
      const author = await registerAndLogin(app);
      const { submission } = await createPendingSubmission(author.userId);
      const moderator = await moderatorAgent();

      const res = await moderator.agent
        .post(`/api/v1/moderation/submissions/${submission.id}/reject`)
        .set("x-csrf-token", moderator.csrfToken)
        .send({ reason: "This repeats an earlier submission." });
      expect(res.status).toBe(200);

      const jobs = await prisma.emailJob.findMany({ where: { toUserId: author.userId, kind: "PUBLICATION_REJECTED" } });
      expect(jobs).toHaveLength(1);
      const data = jobs[0]!.data as { reason: string };
      expect(data.reason).toBe("This repeats an earlier submission.");
    });

    it("request-changes enqueues PUBLICATION_CHANGES_REQUESTED with the reason and an edit link", async () => {
      const author = await registerAndLogin(app);
      const { draft, submission } = await createPendingSubmission(author.userId);
      const moderator = await moderatorAgent();

      const res = await moderator.agent
        .post(`/api/v1/moderation/submissions/${submission.id}/request-changes`)
        .set("x-csrf-token", moderator.csrfToken)
        .send({ reason: "Please remove the phone number in paragraph two." });
      expect(res.status).toBe(200);

      const jobs = await prisma.emailJob.findMany({ where: { toUserId: author.userId, kind: "PUBLICATION_CHANGES_REQUESTED" } });
      expect(jobs).toHaveLength(1);
      const data = jobs[0]!.data as { reason: string; draftEditUrl: string };
      expect(data.reason).toBe("Please remove the phone number in paragraph two.");
      expect(data.draftEditUrl).toContain(draft.id);
    });

    it("never notifies the moderator, only the submitter", async () => {
      const author = await registerAndLogin(app);
      const { submission } = await createPendingSubmission(author.userId);
      const moderator = await moderatorAgent();

      await moderator.agent
        .post(`/api/v1/moderation/submissions/${submission.id}/approve`)
        .set("x-csrf-token", moderator.csrfToken)
        .send({ reason: "Fine." });

      const moderatorJobs = await prisma.emailJob.findMany({ where: { toUserId: moderator.userId, kind: "PUBLICATION_APPROVED" } });
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

      const jobs = await prisma.emailJob.findMany({ where: { toUserId: author.userId, kind: "COMMENT_RECEIVED" } });
      expect(jobs).toHaveLength(1);
      const data = jobs[0]!.data as { commenterName: string; commentBody: string; publicationTitle: string };
      expect(data.commenterName).toBe("Someone");
      expect(data.commentBody).toBe("This resonated with me.");
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

      const jobs = await prisma.emailJob.findMany({ where: { kind: "COMMENT_RECEIVED" } });
      expect(jobs).toHaveLength(0);
    });
  });
});
