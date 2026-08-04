import { randomUUID } from "node:crypto";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { Role } from "@noteschain/shared";
import { createApp } from "../app.js";
import { prisma } from "../lib/prisma.js";
import { promoteRole, registerAndLogin, resetTestDb, type TestSession } from "./helpers.js";

const app = createApp();
const randomId = () => randomUUID();

const ADMIN_ROUTES: Array<{ method: "get" | "post"; path: string; body?: Record<string, unknown> }> = [
  { method: "post", path: `/api/v1/admin/publications/${randomId()}/delist`, body: { reason: "test" } },
  { method: "post", path: `/api/v1/admin/publications/${randomId()}/restore-listing` },
  { method: "get", path: "/api/v1/admin/reports" },
  { method: "post", path: `/api/v1/admin/reports/${randomId()}/resolve`, body: { action: "DISMISSED" } },
  { method: "get", path: "/api/v1/admin/audit-log" },
  { method: "get", path: "/api/v1/admin/blockchain/jobs" },
  { method: "post", path: `/api/v1/admin/blockchain/jobs/${randomId()}/retry` },
];

const MODERATOR_ROUTES: Array<{ method: "get" | "post"; path: string; body?: Record<string, unknown> }> = [
  { method: "get", path: "/api/v1/moderation/submissions" },
  { method: "get", path: `/api/v1/moderation/submissions/${randomId()}` },
  { method: "post", path: `/api/v1/moderation/submissions/${randomId()}/approve`, body: { reason: "test" } },
  { method: "post", path: `/api/v1/moderation/submissions/${randomId()}/reject`, body: { reason: "test" } },
  { method: "post", path: `/api/v1/moderation/submissions/${randomId()}/request-changes`, body: { reason: "test" } },
];

async function call(
  agent: TestSession["agent"] | null,
  csrfToken: string | undefined,
  route: { method: "get" | "post"; path: string; body?: Record<string, unknown> },
) {
  const client = agent ?? request(app);
  const req = client[route.method](route.path);
  if (csrfToken) req.set("x-csrf-token", csrfToken);
  return route.body !== undefined ? req.send(route.body) : req.send();
}

describe("privilege escalation — admin routes", () => {
  let user: TestSession;
  let moderator: TestSession;
  let admin: TestSession;

  beforeAll(async () => {
    await resetTestDb();
    user = await registerAndLogin(app);
    moderator = await registerAndLogin(app);
    admin = await registerAndLogin(app);
    await promoteRole(moderator.userId, Role.MODERATOR);
    await promoteRole(admin.userId, Role.ADMIN);
  });

  afterAll(async () => {
    await resetTestDb();
    await prisma.$disconnect();
  });

  it("rejects every admin route for an unauthenticated caller (401)", async () => {
    for (const route of ADMIN_ROUTES) {
      const res = await call(null, undefined, route);
      expect(res.status, `${route.method.toUpperCase()} ${route.path}`).toBe(401);
    }
  });

  it("rejects every admin route for a plain USER (403)", async () => {
    for (const route of ADMIN_ROUTES) {
      const res = await call(user.agent, user.csrfToken, route);
      expect(res.status, `${route.method.toUpperCase()} ${route.path}`).toBe(403);
    }
  });

  it("rejects every admin route for a MODERATOR (403 — admin is a strictly higher tier)", async () => {
    for (const route of ADMIN_ROUTES) {
      const res = await call(moderator.agent, moderator.csrfToken, route);
      expect(res.status, `${route.method.toUpperCase()} ${route.path}`).toBe(403);
    }
  });

  it("lets an ADMIN reach every admin route's real handler (never 401/403)", async () => {
    for (const route of ADMIN_ROUTES) {
      const res = await call(admin.agent, admin.csrfToken, route);
      expect([401, 403]).not.toContain(res.status);
    }
  });

  it("rejects every moderation route for an unauthenticated caller (401)", async () => {
    for (const route of MODERATOR_ROUTES) {
      const res = await call(null, undefined, route);
      expect(res.status, `${route.method.toUpperCase()} ${route.path}`).toBe(401);
    }
  });

  it("rejects every moderation route for a plain USER (403)", async () => {
    for (const route of MODERATOR_ROUTES) {
      const res = await call(user.agent, user.csrfToken, route);
      expect(res.status, `${route.method.toUpperCase()} ${route.path}`).toBe(403);
    }
  });

  it("lets a MODERATOR reach every moderation route's real handler (never 401/403)", async () => {
    for (const route of MODERATOR_ROUTES) {
      const res = await call(moderator.agent, moderator.csrfToken, route);
      expect([401, 403]).not.toContain(res.status);
    }
  });

  it("lets an ADMIN reach every moderation route's real handler too (role rank, not exact match)", async () => {
    for (const route of MODERATOR_ROUTES) {
      const res = await call(admin.agent, admin.csrfToken, route);
      expect([401, 403]).not.toContain(res.status);
    }
  });

  it("requires auth but not a role on /publications/:id/report — the one asymmetric route", async () => {
    const anon = await call(null, undefined, { method: "post", path: `/api/v1/publications/${randomId()}/report`, body: { reason: "x" } });
    expect(anon.status).toBe(401);

    const asUser = await call(user.agent, user.csrfToken, {
      method: "post",
      path: `/api/v1/publications/${randomId()}/report`,
      body: { reason: "x" },
    });
    expect([401, 403]).not.toContain(asUser.status);
  });
});
