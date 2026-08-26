import { beforeEach, describe, expect, it, vi } from "vitest";

const mockPrisma = {
  pushJob: { findUniqueOrThrow: vi.fn(), update: vi.fn() },
};

vi.mock("../lib/prisma.js", () => ({ prisma: mockPrisma }));

const { markPushJobFailed, markPushJobSucceeded } = await import("./claimPushJob.js");

beforeEach(() => {
  vi.clearAllMocks();
});

describe("markPushJobSucceeded", () => {
  it("marks the job SENT and stamps sentAt", async () => {
    await markPushJobSucceeded("job-1");

    expect(mockPrisma.pushJob.update).toHaveBeenCalledWith({
      where: { id: "job-1" },
      data: { status: "SENT", sentAt: expect.any(Date) },
    });
  });
});

describe("markPushJobFailed", () => {
  it("increments attempts, records the error, and schedules a retry via backoff", async () => {
    mockPrisma.pushJob.findUniqueOrThrow.mockResolvedValue({ id: "job-1", attempts: 1, maxAttempts: 5 });
    mockPrisma.pushJob.update.mockResolvedValue({ id: "job-1", attempts: 2, maxAttempts: 5 });

    const updated = await markPushJobFailed("job-1", "Firebase unreachable");

    expect(mockPrisma.pushJob.update).toHaveBeenCalledWith({
      where: { id: "job-1" },
      data: {
        status: "FAILED",
        attempts: 2,
        lastError: "Firebase unreachable",
        nextAttemptAt: expect.any(Date),
      },
    });
    expect(updated).toEqual({ id: "job-1", attempts: 2, maxAttempts: 5 });
  });

  it("truncates a runaway error message to 2000 characters", async () => {
    mockPrisma.pushJob.findUniqueOrThrow.mockResolvedValue({ id: "job-1", attempts: 0, maxAttempts: 5 });
    mockPrisma.pushJob.update.mockResolvedValue({ id: "job-1", attempts: 1, maxAttempts: 5 });

    await markPushJobFailed("job-1", "x".repeat(5000));

    const call = mockPrisma.pushJob.update.mock.calls.at(0)?.[0];
    expect(call?.data.lastError).toHaveLength(2000);
  });
});
