import request from "supertest";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../app.js";
import { prisma } from "../lib/prisma.js";
import { registerAndLogin, resetTestDb } from "./helpers.js";

const app = createApp();

describe("push token registration", () => {
  afterAll(async () => {
    await resetTestDb();
    await prisma.$disconnect();
  });

  beforeEach(async () => {
    await resetTestDb();
  });

  it("registers a device token for the signed-in user", async () => {
    const keeper = await registerAndLogin(app);

    const res = await keeper.agent
      .post("/api/v1/push/tokens")
      .set("x-csrf-token", keeper.csrfToken)
      .send({ token: "fcm-token-abc", platform: "ANDROID" });
    expect(res.status).toBe(201);

    const stored = await prisma.pushToken.findUniqueOrThrow({ where: { token: "fcm-token-abc" } });
    expect(stored.userId).toBe(keeper.userId);
    expect(stored.platform).toBe("ANDROID");
  });

  it("requires auth", async () => {
    const res = await request(app).post("/api/v1/push/tokens").send({ token: "fcm-token-abc", platform: "ANDROID" });
    expect(res.status).toBe(401);
  });

  it("reassigns an already-known token to whoever registers it next, not the original owner", async () => {
    const first = await registerAndLogin(app);
    await first.agent.post("/api/v1/push/tokens").set("x-csrf-token", first.csrfToken).send({ token: "shared-device", platform: "ANDROID" });

    const second = await registerAndLogin(app);
    await second.agent.post("/api/v1/push/tokens").set("x-csrf-token", second.csrfToken).send({ token: "shared-device", platform: "ANDROID" });

    const stored = await prisma.pushToken.findUniqueOrThrow({ where: { token: "shared-device" } });
    expect(stored.userId).toBe(second.userId);

    const rows = await prisma.pushToken.findMany({ where: { token: "shared-device" } });
    expect(rows).toHaveLength(1);
  });

  it("unregisters only the caller's own token", async () => {
    const owner = await registerAndLogin(app);
    await owner.agent.post("/api/v1/push/tokens").set("x-csrf-token", owner.csrfToken).send({ token: "device-1", platform: "IOS" });

    const stranger = await registerAndLogin(app);
    // Scoped to (token, userId) server-side — a stranger who somehow knew the
    // token string still can't delete someone else's registration.
    await stranger.agent.delete("/api/v1/push/tokens").set("x-csrf-token", stranger.csrfToken).send({ token: "device-1" });
    expect(await prisma.pushToken.findUnique({ where: { token: "device-1" } })).not.toBeNull();

    await owner.agent.delete("/api/v1/push/tokens").set("x-csrf-token", owner.csrfToken).send({ token: "device-1" });
    expect(await prisma.pushToken.findUnique({ where: { token: "device-1" } })).toBeNull();
  });
});
