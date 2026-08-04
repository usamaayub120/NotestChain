import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mockTx = {
  workerJob: { update: vi.fn() },
  outboxEvent: { update: vi.fn() },
};

const mockPrisma = {
  $transaction: vi.fn(async (cb: (tx: typeof mockTx) => Promise<void>) => cb(mockTx)),
  workerJob: { findUniqueOrThrow: vi.fn(), update: vi.fn() },
  outboxEvent: { update: vi.fn() },
};

vi.mock("../lib/prisma.js", () => ({ prisma: mockPrisma }));

const { computeBackoff, markJobFailed, markJobSucceeded } = await import("./claimJob.js");

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("computeBackoff", () => {
  it("doubles from the 5s base on each successive attempt", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-01T00:00:00.000Z"));

    expect(computeBackoff(0)).toEqual(new Date("2026-01-01T00:00:05.000Z"));
    expect(computeBackoff(1)).toEqual(new Date("2026-01-01T00:00:10.000Z"));
    expect(computeBackoff(2)).toEqual(new Date("2026-01-01T00:00:20.000Z"));
  });

  it("caps at 10 minutes no matter how many attempts", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-01T00:00:00.000Z"));

    expect(computeBackoff(7)).toEqual(new Date("2026-01-01T00:10:00.000Z"));
    expect(computeBackoff(20)).toEqual(new Date("2026-01-01T00:10:00.000Z"));
  });
});

describe("markJobSucceeded", () => {
  it("marks the job PROCESSED and its outbox event PROCESSED, in one transaction", async () => {
    mockTx.workerJob.update.mockResolvedValue({ id: "job-1", outboxEventId: "evt-1" });

    await markJobSucceeded("job-1");

    expect(mockPrisma.$transaction).toHaveBeenCalledTimes(1);
    expect(mockTx.workerJob.update).toHaveBeenCalledWith({
      where: { id: "job-1" },
      data: { status: "PROCESSED" },
    });
    expect(mockTx.outboxEvent.update).toHaveBeenCalledWith({
      where: { id: "evt-1" },
      data: { status: "PROCESSED", processedAt: expect.any(Date) },
    });
  });
});

describe("markJobFailed", () => {
  it("increments attempts, records the error, and schedules the next attempt via backoff", async () => {
    mockPrisma.workerJob.findUniqueOrThrow.mockResolvedValue({
      id: "job-1",
      outboxEventId: "evt-1",
      attempts: 2,
      maxAttempts: 5,
    });

    await markJobFailed("job-1", "boom");

    expect(mockPrisma.workerJob.update).toHaveBeenCalledWith({
      where: { id: "job-1" },
      data: {
        status: "FAILED",
        attempts: 3,
        lastError: "boom",
        nextAttemptAt: expect.any(Date),
      },
    });
    expect(mockPrisma.outboxEvent.update).toHaveBeenCalledWith({
      where: { id: "evt-1" },
      data: { status: "FAILED", attempts: 3, lastError: "boom" },
    });
  });

  it("truncates errors to 2000 characters so a runaway message can't blow out the column", async () => {
    mockPrisma.workerJob.findUniqueOrThrow.mockResolvedValue({
      id: "job-1",
      outboxEventId: "evt-1",
      attempts: 0,
      maxAttempts: 5,
    });

    await markJobFailed("job-1", "x".repeat(5000));

    const call = mockPrisma.workerJob.update.mock.calls.at(0)?.[0];
    expect(call?.data.lastError).toHaveLength(2000);
  });
});
