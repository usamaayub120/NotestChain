import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../app.js";
import { prisma } from "../lib/prisma.js";
import { promoteRole, registerAndLogin, resetTestDb } from "./helpers.js";

const app = createApp();

/**
 * The moderator's reason has always been stored and emailed, but the draft DTO
 * dropped it, so the author was told "This submission was rejected." and
 * nothing else -  while the moderator's own confirmation dialog promised them
 * the author would see it.
 *
 * The gating matters as much as the exposure: the notification builders send
 * `reason` for REJECT and REQUEST_CHANGES and withhold it on APPROVE, where it
 * is the moderator's internal justification. This read path has to match that
 * exactly, and `note` must never leave the server under any action.
 */
describe("moderation feedback on the draft DTO", () => {
  afterAll(async () => {
    await resetTestDb();
    await prisma.$disconnect();
  });

  beforeEach(async () => {
    await resetTestDb();
  });

  async function submittedDraft(authorUserId: string) {
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

  async function decide(submissionId: string, action: string, reason: string) {
    const moderator = await registerAndLogin(app);
    await promoteRole(moderator.userId, "MODERATOR");
    const res = await moderator.agent
      .post(`/api/v1/moderation/submissions/${submissionId}/${action}`)
      .set("x-csrf-token", moderator.csrfToken)
      .send({ reason });
    if (res.status !== 200) throw new Error(`${action} failed: ${res.status} ${JSON.stringify(res.body)}`);
  }

  it("gives the author the reason when changes are requested", async () => {
    const author = await registerAndLogin(app);
    const { draft, submission } = await submittedDraft(author.userId);

    await decide(submission.id, "request-changes", "The ending trails off -  give it one more pass.");

    const res = await author.agent.get(`/api/v1/drafts/${draft.id}`);
    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe("CHANGES_REQUESTED");
    expect(res.body.data.moderation).toMatchObject({
      action: "REQUEST_CHANGES",
      reason: "The ending trails off -  give it one more pass.",
    });
  });

  it("gives the author the reason when the submission is rejected", async () => {
    const author = await registerAndLogin(app);
    const { draft, submission } = await submittedDraft(author.userId);

    await decide(submission.id, "reject", "Does not read as a complete thought yet.");

    const res = await author.agent.get(`/api/v1/drafts/${draft.id}`);
    expect(res.body.data.status).toBe("REJECTED");
    expect(res.body.data.moderation.reason).toBe("Does not read as a complete thought yet.");
  });

  it("withholds the reason on approval, matching what the notifications send", async () => {
    const author = await registerAndLogin(app);
    const { draft, submission } = await submittedDraft(author.userId);

    await decide(submission.id, "approve", "Internal note: fine, nothing to flag.");

    const res = await author.agent.get(`/api/v1/drafts/${draft.id}`);
    expect(res.body.data.status).toBe("APPROVED");
    expect(res.body.data.moderation).toBeNull();
    expect(JSON.stringify(res.body)).not.toContain("Internal note");
  });

  it("keeps the reason on the draft list, not just the detail route", async () => {
    const author = await registerAndLogin(app);
    const { draft, submission } = await submittedDraft(author.userId);
    await decide(submission.id, "request-changes", "Trim the middle section.");

    const res = await author.agent.get("/api/v1/drafts");
    const listed = res.body.data.find((item: { id: string }) => item.id === draft.id);
    expect(listed.moderation.reason).toBe("Trim the middle section.");
  });

  it("survives an autosave, which writes its response straight into the client cache", async () => {
    const author = await registerAndLogin(app);
    const { draft, submission } = await submittedDraft(author.userId);
    await decide(submission.id, "request-changes", "One more pass on the opening.");

    // CHANGES_REQUESTED is editable, so the author types and the editor saves.
    // If this response dropped `moderation`, the banner would vanish mid-edit.
    const res = await author.agent
      .post(`/api/v1/drafts/${draft.id}/autosave`)
      .set("x-csrf-token", author.csrfToken)
      .send({ title: "A short thought", content: "Something worth keeping, now with an opening." });

    expect(res.status).toBe(200);
    expect(res.body.data.moderation.reason).toBe("One more pass on the opening.");
  });

  it("never exposes the moderator's internal note", async () => {
    const author = await registerAndLogin(app);
    const { draft, submission } = await submittedDraft(author.userId);
    await decide(submission.id, "reject", "Public reason the author should read.");
    await prisma.moderationDecision.updateMany({
      where: { submissionId: submission.id },
      data: { note: "Internal-only moderator note." },
    });

    const res = await author.agent.get(`/api/v1/drafts/${draft.id}`);
    expect(JSON.stringify(res.body)).not.toContain("Internal-only");
    expect(res.body.data.moderation).not.toHaveProperty("note");
  });
});
