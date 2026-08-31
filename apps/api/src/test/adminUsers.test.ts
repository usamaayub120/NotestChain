import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createApp } from "../app.js";
import { prisma } from "../lib/prisma.js";
import { promoteRole, registerAndLogin, resetTestDb, type TestSession } from "./helpers.js";
import { Role } from "@noteschain/shared";

const app = createApp();

describe("admin users", () => {
  let admin: TestSession;
  let member: TestSession;

  beforeAll(async () => {
    await resetTestDb();
    admin = await registerAndLogin(app, undefined, { username: "admin-user", displayName: "Admin user" });
    member = await registerAndLogin(app, undefined, { username: "member-user", displayName: "Member user" });
    await promoteRole(admin.userId, Role.ADMIN);
    await prisma.user.update({ where: { id: member.userId }, data: { lastLoginAt: new Date() } });
  });

  afterAll(async () => {
    await resetTestDb();
    await prisma.$disconnect();
  });

  it("lists account activity and aggregate account health for an admin", async () => {
    const users = await admin.agent.get("/api/v1/admin/users?search=member-user");
    expect(users.status).toBe(200);
    expect(users.body.meta.total).toBe(1);
    expect(users.body.data[0]).toMatchObject({
      id: member.userId,
      status: "ACTIVE",
      primaryIdentity: { username: "member-user", displayName: "Member user" },
      lastActiveAt: expect.any(String),
      publishedNotes: 0,
      comments: 0,
    });

    const stats = await admin.agent.get("/api/v1/admin/users/stats");
    expect(stats.status).toBe(200);
    expect(stats.body.data).toMatchObject({ total: 2, active: 2, suspended: 0, activeLast7Days: 2 });
  });

  it("suspends a member, revokes sessions, audits the action, and can reinstate", async () => {
    const suspended = await admin.agent
      .patch(`/api/v1/admin/users/${member.userId}/status`)
      .set("x-csrf-token", admin.csrfToken)
      .send({ status: "SUSPENDED", reason: "Repeated abuse reports" });
    expect(suspended.status).toBe(200);
    expect(suspended.body.data.status).toBe("SUSPENDED");
    expect(await prisma.session.count({ where: { userId: member.userId, revokedAt: null } })).toBe(0);
    expect(await prisma.auditLog.findFirst({ where: { targetId: member.userId, action: "USER_SUSPENDED" } })).not.toBeNull();

    const reinstated = await admin.agent
      .patch(`/api/v1/admin/users/${member.userId}/status`)
      .set("x-csrf-token", admin.csrfToken)
      .send({ status: "ACTIVE", reason: "Appeal reviewed" });
    expect(reinstated.status).toBe(200);
    expect(reinstated.body.data.status).toBe("ACTIVE");
  });

  it("does not allow administrative account deletion or edits to an admin", async () => {
    const deletion = await admin.agent
      .patch(`/api/v1/admin/users/${member.userId}/status`)
      .set("x-csrf-token", admin.csrfToken)
      .send({ status: "DELETED", reason: "test" });
    expect(deletion.status).toBe(400);

    const editAdmin = await admin.agent
      .patch(`/api/v1/admin/users/${admin.userId}/status`)
      .set("x-csrf-token", admin.csrfToken)
      .send({ status: "SUSPENDED", reason: "test" });
    expect(editAdmin.status).toBe(403);
  });
});
