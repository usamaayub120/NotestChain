import { beforeEach, describe, expect, it, vi } from "vitest";

const mockPrisma = {
  workerJob: {
    update: vi.fn(),
    findUniqueOrThrow: vi.fn(),
  },
  publicationChainRecord: {
    update: vi.fn(),
  },
};

const mockClaimNextJob = vi.fn();
const mockMarkJobFailed = vi.fn();
const mockMarkJobSucceeded = vi.fn();
const mockPublishPublicationToChain = vi.fn();

const stubLogger = { info: vi.fn(), error: vi.fn(), child: vi.fn(() => stubLogger) };

vi.mock("../lib/prisma.js", () => ({ prisma: mockPrisma }));
// Stubbed so this suite never touches config/env.js, which hard-exits the
// process when DATABASE_URL isn't set (it isn't, under vitest).
vi.mock("../lib/logger.js", () => ({ logger: stubLogger }));
vi.mock("./claimJob.js", () => ({
  claimNextJob: mockClaimNextJob,
  markJobFailed: mockMarkJobFailed,
  markJobSucceeded: mockMarkJobSucceeded,
}));
// Stand in for the real module entirely (rather than importActual) — the
// real one pulls in solanaClient.js -> config/env.js, which hard-exits the
// process if DATABASE_URL etc. aren't set, which they aren't in this suite.
vi.mock("./publishToChain.js", () => {
  class PermanentPublishError extends Error {}
  return {
    PermanentPublishError,
    publishPublicationToChain: mockPublishPublicationToChain,
  };
});

const { claimAndProcessOutbox } = await import("./outboxProcessor.js");
const { PermanentPublishError } = await import("./publishToChain.js");

const JOB = { id: "job-1", publicationId: "pub-1", attempts: 0, maxAttempts: 5 };

beforeEach(() => {
  vi.clearAllMocks();
});

describe("claimAndProcessOutbox", () => {
  it("does nothing when there is no due job", async () => {
    mockClaimNextJob.mockResolvedValue(null);

    await claimAndProcessOutbox();

    expect(mockPublishPublicationToChain).not.toHaveBeenCalled();
    expect(mockMarkJobSucceeded).not.toHaveBeenCalled();
    expect(mockMarkJobFailed).not.toHaveBeenCalled();
  });

  it("marks the job succeeded when publishing completes", async () => {
    mockClaimNextJob.mockResolvedValue(JOB);
    mockPublishPublicationToChain.mockResolvedValue(undefined);

    await claimAndProcessOutbox();

    expect(mockPublishPublicationToChain).toHaveBeenCalledWith("pub-1", "job-1");
    expect(mockMarkJobSucceeded).toHaveBeenCalledWith("job-1");
    expect(mockMarkJobFailed).not.toHaveBeenCalled();
  });

  it("jumps straight to exhausted on a permanent error, skipping the normal backoff schedule", async () => {
    mockClaimNextJob.mockResolvedValue(JOB);
    mockPublishPublicationToChain.mockRejectedValue(new PermanentPublishError("content hash mismatch"));

    await claimAndProcessOutbox();

    expect(mockMarkJobFailed).toHaveBeenCalledWith("job-1", "content hash mismatch");
    expect(mockPrisma.workerJob.update).toHaveBeenCalledWith({
      where: { id: "job-1" },
      data: { attempts: JOB.maxAttempts },
    });
    expect(mockPrisma.publicationChainRecord.update).toHaveBeenCalledWith({
      where: { publicationId: "pub-1" },
      data: { chainStatus: "FAILED_PERMANENT", lastError: "content hash mismatch" },
    });
  });

  it("marks the chain record retryable when a transient error still has attempts left", async () => {
    mockClaimNextJob.mockResolvedValue(JOB);
    mockPublishPublicationToChain.mockRejectedValue(new Error("RPC timeout"));
    mockPrisma.workerJob.findUniqueOrThrow.mockResolvedValue({ ...JOB, attempts: 1, maxAttempts: 5 });

    await claimAndProcessOutbox();

    expect(mockMarkJobFailed).toHaveBeenCalledWith("job-1", "RPC timeout");
    expect(mockPrisma.workerJob.update).not.toHaveBeenCalled();
    expect(mockPrisma.publicationChainRecord.update).toHaveBeenCalledWith({
      where: { publicationId: "pub-1" },
      data: { chainStatus: "FAILED_RETRYABLE", lastError: "RPC timeout" },
    });
  });

  it("marks the chain record permanently failed once a transient error exhausts all attempts", async () => {
    mockClaimNextJob.mockResolvedValue(JOB);
    mockPublishPublicationToChain.mockRejectedValue(new Error("RPC timeout"));
    mockPrisma.workerJob.findUniqueOrThrow.mockResolvedValue({ ...JOB, attempts: 5, maxAttempts: 5 });

    await claimAndProcessOutbox();

    expect(mockPrisma.publicationChainRecord.update).toHaveBeenCalledWith({
      where: { publicationId: "pub-1" },
      data: { chainStatus: "FAILED_PERMANENT", lastError: "RPC timeout" },
    });
  });
});
