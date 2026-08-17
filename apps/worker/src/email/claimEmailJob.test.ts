import { beforeEach, describe, expect, it, vi } from "vitest";

const mockPrisma = {
  emailJob: { findUniqueOrThrow: vi.fn(), update: vi.fn() },
};

vi.mock("../lib/prisma.js", () => ({ prisma: mockPrisma }));

const { markEmailJobFailed, markEmailJobSucceeded } = await import("./claimEmailJob.js");

beforeEach(() => {
  vi.clearAllMocks();
});

describe("markEmailJobSucceeded", () => {
  it("marks the job SENT and stamps sentAt", async () => {
    await markEmailJobSucceeded("job-1");

    expect(mockPrisma.emailJob.update).toHaveBeenCalledWith({
      where: { id: "job-1" },
      data: { status: "SENT", sentAt: expect.any(Date) },
    });
  });
});

describe("markEmailJobFailed", () => {
  it("increments attempts, records the error, and schedules a retry via backoff", async () => {
    mockPrisma.emailJob.findUniqueOrThrow.mockResolvedValue({ id: "job-1", attempts: 1, maxAttempts: 5 });
    mockPrisma.emailJob.update.mockResolvedValue({ id: "job-1", attempts: 2, maxAttempts: 5 });

    const updated = await markEmailJobFailed("job-1", "SMTP connection refused");

    expect(mockPrisma.emailJob.update).toHaveBeenCalledWith({
      where: { id: "job-1" },
      data: {
        status: "FAILED",
        attempts: 2,
        lastError: "SMTP connection refused",
        nextAttemptAt: expect.any(Date),
      },
    });
    // The processor decides whether to flag exhaustion off this return value.
    expect(updated).toEqual({ id: "job-1", attempts: 2, maxAttempts: 5 });
  });

  it("truncates a runaway error message to 2000 characters", async () => {
    mockPrisma.emailJob.findUniqueOrThrow.mockResolvedValue({ id: "job-1", attempts: 0, maxAttempts: 5 });
    mockPrisma.emailJob.update.mockResolvedValue({ id: "job-1", attempts: 1, maxAttempts: 5 });

    await markEmailJobFailed("job-1", "x".repeat(5000));

    const call = mockPrisma.emailJob.update.mock.calls.at(0)?.[0];
    expect(call?.data.lastError).toHaveLength(2000);
  });
});
