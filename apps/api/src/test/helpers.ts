import request from "supertest";
import type { Express } from "express";
import type { Role } from "@noteschain/shared";
import { prisma } from "../lib/prisma.js";

export interface TestSession {
  agent: ReturnType<typeof request.agent>;
  userId: string;
  csrfToken: string;
}

function extractCookieValue(setCookieHeader: string | string[] | undefined, name: string): string {
  const lines = Array.isArray(setCookieHeader) ? setCookieHeader : setCookieHeader ? [setCookieHeader] : [];
  const line = lines.find((c) => c.startsWith(`${name}=`));
  const match = line?.match(new RegExp(`${name}=([^;]+)`));
  if (!match) throw new Error(`Cookie "${name}" not found in Set-Cookie header.`);
  return decodeURIComponent(match[1]!);
}

let counter = 0;

/** Registers a fresh user via the real HTTP endpoint (exercises the actual auth flow) and returns a cookie-jar-backed agent plus its CSRF token. */
export async function registerAndLogin(app: Express, password = "a-strong-test-password-1"): Promise<TestSession> {
  counter += 1;
  const email = `test-user-${Date.now()}-${counter}@noteschain.test`;
  const agent = request.agent(app);

  const res = await agent.post("/api/v1/auth/register").send({ email, password });
  if (res.status !== 201) {
    throw new Error(`Register failed: ${res.status} ${JSON.stringify(res.body)}`);
  }

  const csrfToken = extractCookieValue(res.headers["set-cookie"], "nc_csrf");
  return { agent, userId: res.body.data.user.id, csrfToken };
}

export async function promoteRole(userId: string, role: Role): Promise<void> {
  await prisma.user.update({ where: { id: userId }, data: { role } });
}

/** Clears everything an integration test run could have created — run between test files, not inside one, since fileParallelism is off. */
export async function resetTestDb(): Promise<void> {
  await prisma.$transaction([
    prisma.auditLog.deleteMany(),
    prisma.report.deleteMany(),
    prisma.workerJob.deleteMany(),
    prisma.outboxEvent.deleteMany(),
    prisma.publicationChainRecord.deleteMany(),
    prisma.publication.deleteMany(),
    prisma.moderationDecision.deleteMany(),
    prisma.submission.deleteMany(),
    prisma.draftVersion.deleteMany(),
    prisma.draft.deleteMany(),
    prisma.bookmark.deleteMany(),
    prisma.bookmarkCollection.deleteMany(),
    prisma.publicIdentity.deleteMany(),
    prisma.session.deleteMany(),
    prisma.user.deleteMany(),
  ]);
}
