import request from "supertest";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../app.js";
import { prisma } from "../lib/prisma.js";
import { registerAndLogin, resetTestDb } from "./helpers.js";

const app = createApp();

/** Pulls the raw token out of the queued email's data — the only place it ever exists off the wire, since only its hash is ever persisted. */
async function extractResetToken(userId: string): Promise<string> {
  const job = await prisma.emailJob.findFirstOrThrow({ where: { toUserId: userId, kind: "PASSWORD_RESET_REQUESTED" } });
  const data = job.data as { resetUrl: string };
  const token = new URL(data.resetUrl).searchParams.get("token");
  if (!token) throw new Error("resetUrl carried no token");
  return token;
}

describe("password reset", () => {
  afterAll(async () => {
    await resetTestDb();
    await prisma.$disconnect();
  });

  beforeEach(async () => {
    await resetTestDb();
  });

  describe("POST /auth/forgot-password", () => {
    it("enqueues a reset email and a token for an existing account", async () => {
      const { userId } = await registerAndLogin(app, "the-original-password-1");
      const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });

      const res = await request(app).post("/api/v1/auth/forgot-password").send({ email: user.email });
      expect(res.status).toBe(200);

      const tokens = await prisma.passwordResetToken.findMany({ where: { userId } });
      expect(tokens).toHaveLength(1);
      expect(tokens[0]!.usedAt).toBeNull();

      const jobs = await prisma.emailJob.findMany({ where: { toUserId: userId, kind: "PASSWORD_RESET_REQUESTED" } });
      expect(jobs).toHaveLength(1);
      const data = jobs[0]!.data as { resetUrl: string; expiryMinutes: number };
      expect(data.resetUrl).toContain("/reset-password?token=");
      expect(data.expiryMinutes).toBe(30);
    });

    it("responds identically for an email that has no account — never confirms or denies it exists", async () => {
      const known = await registerAndLogin(app);
      const knownUser = await prisma.user.findUniqueOrThrow({ where: { id: known.userId } });

      const resKnown = await request(app).post("/api/v1/auth/forgot-password").send({ email: knownUser.email });
      const resUnknown = await request(app)
        .post("/api/v1/auth/forgot-password")
        .send({ email: "nobody-here@noteschain.test" });

      expect(resKnown.status).toBe(resUnknown.status);
      expect(resKnown.body).toEqual(resUnknown.body);

      // And, unlike the known case, nothing was actually queued.
      const jobs = await prisma.emailJob.findMany({ where: { kind: "PASSWORD_RESET_REQUESTED" } });
      expect(jobs).toHaveLength(1);
    });
  });

  describe("POST /auth/reset-password", () => {
    it("changes the password, and the new password actually works at login", async () => {
      const { userId } = await registerAndLogin(app, "the-original-password-1");
      const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });

      await request(app).post("/api/v1/auth/forgot-password").send({ email: user.email });
      const token = await extractResetToken(userId);

      const resetRes = await request(app).post("/api/v1/auth/reset-password").send({ token, password: "a-brand-new-password-2" });
      expect(resetRes.status).toBe(200);

      const oldLogin = await request(app)
        .post("/api/v1/auth/login")
        .send({ email: user.email, password: "the-original-password-1" });
      expect(oldLogin.status).toBe(401);

      const newLogin = await request(app)
        .post("/api/v1/auth/login")
        .send({ email: user.email, password: "a-brand-new-password-2" });
      expect(newLogin.status).toBe(200);
    });

    it("revokes every existing session for the account", async () => {
      const author = await registerAndLogin(app, "the-original-password-1");
      const user = await prisma.user.findUniqueOrThrow({ where: { id: author.userId } });

      const beforeReset = await author.agent.get("/api/v1/auth/me");
      expect(beforeReset.status).toBe(200);

      await request(app).post("/api/v1/auth/forgot-password").send({ email: user.email });
      const token = await extractResetToken(author.userId);
      await request(app).post("/api/v1/auth/reset-password").send({ token, password: "a-brand-new-password-2" });

      const afterReset = await author.agent.get("/api/v1/auth/me");
      expect(afterReset.status).toBe(401);
    });

    it("rejects a token that doesn't exist", async () => {
      const res = await request(app).post("/api/v1/auth/reset-password").send({ token: "not-a-real-token", password: "whatever-new-1" });
      expect(res.status).toBe(400);
    });

    it("rejects a token that has already been used once", async () => {
      const { userId } = await registerAndLogin(app);
      const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
      await request(app).post("/api/v1/auth/forgot-password").send({ email: user.email });
      const token = await extractResetToken(userId);

      const first = await request(app).post("/api/v1/auth/reset-password").send({ token, password: "first-new-password-1" });
      expect(first.status).toBe(200);

      const second = await request(app).post("/api/v1/auth/reset-password").send({ token, password: "second-new-password-1" });
      expect(second.status).toBe(400);
    });

    it("rejects an expired token", async () => {
      const { userId } = await registerAndLogin(app);
      const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
      await request(app).post("/api/v1/auth/forgot-password").send({ email: user.email });
      const token = await extractResetToken(userId);

      await prisma.passwordResetToken.updateMany({
        where: { userId },
        data: { expiresAt: new Date(Date.now() - 1000) },
      });

      const res = await request(app).post("/api/v1/auth/reset-password").send({ token, password: "whatever-new-1" });
      expect(res.status).toBe(400);
    });
  });
});
