import { beforeEach, describe, expect, it, vi } from "vitest";

const mockPrisma = {
  auditLog: { create: vi.fn() },
};

const mockClaim = {
  claimNextPushJob: vi.fn(),
  markPushJobSucceeded: vi.fn(),
  markPushJobFailed: vi.fn(),
};

const mockSender = { sendPushToUser: vi.fn() };
const mockRenderPush = vi.fn();

vi.mock("../lib/prisma.js", () => ({ prisma: mockPrisma }));
vi.mock("./claimPushJob.js", () => mockClaim);
vi.mock("./pushSender.js", () => mockSender);
// Partial mock, same reasoning as emailProcessor.test.ts: env.ts also pulls
// isFirebaseConfigured/pushEnvShape from this package transitively.
vi.mock("@noteschain/push", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@noteschain/push")>()),
  renderPush: mockRenderPush,
}));

const { claimAndProcessPushJobs } = await import("./pushProcessor.js");

const RENDERED = { title: "New comment", body: "Someone commented on your note.", deepLink: "/note/pub-1" };

beforeEach(() => {
  vi.clearAllMocks();
});

describe("claimAndProcessPushJobs", () => {
  it("does nothing when no job is due", async () => {
    mockClaim.claimNextPushJob.mockResolvedValue(null);

    await claimAndProcessPushJobs();

    expect(mockSender.sendPushToUser).not.toHaveBeenCalled();
  });

  it("renders and sends a claimed job, then marks it succeeded", async () => {
    mockClaim.claimNextPushJob.mockResolvedValue({
      id: "job-1",
      kind: "COMMENT_RECEIVED",
      userId: "user-1",
      data: { publicationId: "pub-1", publicationTitle: "A short thought", commenterName: "Someone" },
    });
    mockRenderPush.mockReturnValue(RENDERED);
    mockSender.sendPushToUser.mockResolvedValue({ delivered: 1, pruned: 0 });

    await claimAndProcessPushJobs();

    expect(mockRenderPush).toHaveBeenCalledWith("COMMENT_RECEIVED", {
      publicationId: "pub-1",
      publicationTitle: "A short thought",
      commenterName: "Someone",
    });
    expect(mockSender.sendPushToUser).toHaveBeenCalledWith("user-1", RENDERED);
    expect(mockClaim.markPushJobSucceeded).toHaveBeenCalledWith("job-1");
    expect(mockClaim.markPushJobFailed).not.toHaveBeenCalled();
  });

  it("treats zero registered devices as success, not failure", async () => {
    // Most Keepers will never have installed the mobile app — that must
    // never make a PushJob retry forever.
    mockClaim.claimNextPushJob.mockResolvedValue({ id: "job-1", kind: "NEW_FOLLOWER", userId: "user-1", data: {} });
    mockRenderPush.mockReturnValue(RENDERED);
    mockSender.sendPushToUser.mockResolvedValue({ delivered: 0, pruned: 0 });

    await claimAndProcessPushJobs();

    expect(mockClaim.markPushJobSucceeded).toHaveBeenCalledWith("job-1");
    expect(mockClaim.markPushJobFailed).not.toHaveBeenCalled();
  });

  it("marks a job failed when sending throws, without flagging the audit log if retries remain", async () => {
    mockClaim.claimNextPushJob.mockResolvedValue({ id: "job-1", kind: "NEW_FOLLOWER", userId: "user-1", data: {} });
    mockRenderPush.mockReturnValue(RENDERED);
    mockSender.sendPushToUser.mockRejectedValue(new Error("Firebase is not configured"));
    mockClaim.markPushJobFailed.mockResolvedValue({ id: "job-1", attempts: 2, maxAttempts: 5 });

    await claimAndProcessPushJobs();

    expect(mockClaim.markPushJobFailed).toHaveBeenCalledWith("job-1", "Firebase is not configured");
    expect(mockPrisma.auditLog.create).not.toHaveBeenCalled();
  });

  it("flags the audit log once the retry budget is exhausted", async () => {
    mockClaim.claimNextPushJob.mockResolvedValue({ id: "job-1", kind: "NEW_FOLLOWER", userId: "user-1", data: {} });
    mockRenderPush.mockReturnValue(RENDERED);
    mockSender.sendPushToUser.mockRejectedValue(new Error("FCM unreachable"));
    mockClaim.markPushJobFailed.mockResolvedValue({ id: "job-1", attempts: 5, maxAttempts: 5 });

    await claimAndProcessPushJobs();

    expect(mockPrisma.auditLog.create).toHaveBeenCalledWith({
      data: {
        action: "PUSH_SEND_EXHAUSTED",
        targetType: "PushJob",
        targetId: "job-1",
        metadata: { kind: "NEW_FOLLOWER", userId: "user-1", attempts: 5, lastError: "FCM unreachable" },
      },
    });
  });

  it("also flags when a malformed job payload fails to render, not just send failures", async () => {
    mockClaim.claimNextPushJob.mockResolvedValue({ id: "job-1", kind: "COMMENT_RECEIVED", userId: "user-1", data: { missing: "fields" } });
    mockRenderPush.mockImplementation(() => {
      throw new Error("Invalid payload");
    });
    mockClaim.markPushJobFailed.mockResolvedValue({ id: "job-1", attempts: 5, maxAttempts: 5 });

    await claimAndProcessPushJobs();

    expect(mockSender.sendPushToUser).not.toHaveBeenCalled();
    expect(mockClaim.markPushJobFailed).toHaveBeenCalledWith("job-1", "Invalid payload");
    expect(mockPrisma.auditLog.create).toHaveBeenCalledTimes(1);
  });
});
