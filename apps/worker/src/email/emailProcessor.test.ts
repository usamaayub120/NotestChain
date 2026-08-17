import { beforeEach, describe, expect, it, vi } from "vitest";

const mockPrisma = {
  auditLog: { create: vi.fn() },
};

const mockClaim = {
  claimNextEmailJob: vi.fn(),
  markEmailJobSucceeded: vi.fn(),
  markEmailJobFailed: vi.fn(),
};

const mockMailer = { sendMail: vi.fn() };
const mockRenderEmail = vi.fn();

vi.mock("../lib/prisma.js", () => ({ prisma: mockPrisma }));
vi.mock("./claimEmailJob.js", () => mockClaim);
vi.mock("./mailer.js", () => mockMailer);
// Partial mock: env.ts (pulled in transitively via ../lib/logger.js) also
// imports emailEnvShape/isSmtpConfigured from this same package, so fully
// replacing the module breaks that unrelated import path.
vi.mock("@noteschain/email", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@noteschain/email")>()),
  renderEmail: mockRenderEmail,
}));

const { claimAndProcessEmailJobs } = await import("./emailProcessor.js");

const RENDERED = { subject: "Hello", html: "<p>Hello</p>", text: "Hello" };

beforeEach(() => {
  vi.clearAllMocks();
});

describe("claimAndProcessEmailJobs", () => {
  it("does nothing when no job is due", async () => {
    mockClaim.claimNextEmailJob.mockResolvedValue(null);

    await claimAndProcessEmailJobs();

    expect(mockMailer.sendMail).not.toHaveBeenCalled();
  });

  it("renders and sends a claimed job, then marks it succeeded", async () => {
    mockClaim.claimNextEmailJob.mockResolvedValue({
      id: "job-1",
      kind: "ACCOUNT_WELCOME",
      toEmail: "writer@example.com",
      data: { startWritingUrl: "https://notes.example/drafts" },
    });
    mockRenderEmail.mockReturnValue(RENDERED);

    await claimAndProcessEmailJobs();

    expect(mockRenderEmail).toHaveBeenCalledWith("ACCOUNT_WELCOME", { startWritingUrl: "https://notes.example/drafts" });
    expect(mockMailer.sendMail).toHaveBeenCalledWith({
      to: "writer@example.com",
      subject: RENDERED.subject,
      html: RENDERED.html,
      text: RENDERED.text,
    });
    expect(mockClaim.markEmailJobSucceeded).toHaveBeenCalledWith("job-1");
    expect(mockClaim.markEmailJobFailed).not.toHaveBeenCalled();
  });

  it("marks a job failed when sending throws, without flagging the audit log if retries remain", async () => {
    mockClaim.claimNextEmailJob.mockResolvedValue({
      id: "job-1",
      kind: "ACCOUNT_WELCOME",
      toEmail: "writer@example.com",
      data: {},
    });
    mockRenderEmail.mockReturnValue(RENDERED);
    mockMailer.sendMail.mockRejectedValue(new Error("SMTP connection refused"));
    mockClaim.markEmailJobFailed.mockResolvedValue({ id: "job-1", attempts: 2, maxAttempts: 5 });

    await claimAndProcessEmailJobs();

    expect(mockClaim.markEmailJobFailed).toHaveBeenCalledWith("job-1", "SMTP connection refused");
    expect(mockPrisma.auditLog.create).not.toHaveBeenCalled();
  });

  it("flags the audit log once the retry budget is exhausted", async () => {
    mockClaim.claimNextEmailJob.mockResolvedValue({
      id: "job-1",
      kind: "PASSWORD_RESET_REQUESTED",
      toEmail: "writer@example.com",
      data: {},
    });
    mockRenderEmail.mockReturnValue(RENDERED);
    mockMailer.sendMail.mockRejectedValue(new Error("Mailbox unavailable"));
    mockClaim.markEmailJobFailed.mockResolvedValue({ id: "job-1", attempts: 5, maxAttempts: 5 });

    await claimAndProcessEmailJobs();

    expect(mockPrisma.auditLog.create).toHaveBeenCalledWith({
      data: {
        action: "EMAIL_SEND_EXHAUSTED",
        targetType: "EmailJob",
        targetId: "job-1",
        metadata: {
          kind: "PASSWORD_RESET_REQUESTED",
          toEmail: "writer@example.com",
          attempts: 5,
          lastError: "Mailbox unavailable",
        },
      },
    });
  });

  it("also flags when a malformed job payload fails to render, not just SMTP failures", async () => {
    mockClaim.claimNextEmailJob.mockResolvedValue({
      id: "job-1",
      kind: "COMMENT_RECEIVED",
      toEmail: "writer@example.com",
      data: { missing: "fields" },
    });
    mockRenderEmail.mockImplementation(() => {
      throw new Error("Invalid payload");
    });
    mockClaim.markEmailJobFailed.mockResolvedValue({ id: "job-1", attempts: 5, maxAttempts: 5 });

    await claimAndProcessEmailJobs();

    expect(mockMailer.sendMail).not.toHaveBeenCalled();
    expect(mockClaim.markEmailJobFailed).toHaveBeenCalledWith("job-1", "Invalid payload");
    expect(mockPrisma.auditLog.create).toHaveBeenCalledTimes(1);
  });
});
