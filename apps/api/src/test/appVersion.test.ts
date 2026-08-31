import request from "supertest";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { Role } from "@noteschain/shared";
import { createApp } from "../app.js";
import { prisma } from "../lib/prisma.js";
import { promoteRole, registerAndLogin, resetTestDb } from "./helpers.js";

const app = createApp();
const releasePolicyToken = "test-only-release-policy-secret-not-used-anywhere-else-00000000";

describe("mobile app version policy", () => {
  beforeEach(resetTestDb);

  afterAll(async () => {
    await resetTestDb();
    await prisma.$disconnect();
  });

  it("returns the public Android build policy without authentication", async () => {
    const response = await request(app).get("/api/v1/app/version");

    expect(response.status).toBe(200);
    expect(response.headers["cache-control"]).toContain("no-store");
    expect(response.headers.etag).toBeUndefined();
    expect(response.body).toEqual({
      data: {
        android: {
          latestBuild: 1,
          minimumBuild: 1,
          latestVersion: "1.0.0",
        },
      },
    });
  });

  it("lets an admin change the minimum build while rejecting invalid ranges", async () => {
    const admin = await registerAndLogin(app);
    await promoteRole(admin.userId, Role.ADMIN);

    const invalid = await admin.agent
      .patch("/api/v1/admin/settings")
      .set("x-csrf-token", admin.csrfToken)
      .send({ indexingEnabled: true, androidLatestBuild: 4, androidMinimumBuild: 5, androidLatestVersion: "1.0.4" });
    expect(invalid.status).toBe(400);

    const update = await admin.agent
      .patch("/api/v1/admin/settings")
      .set("x-csrf-token", admin.csrfToken)
      .send({ indexingEnabled: true, androidLatestBuild: 4, androidMinimumBuild: 3, androidLatestVersion: "1.0.4" });
    expect(update.status).toBe(200);
    expect(update.body.data).toMatchObject({ androidLatestBuild: 4, androidMinimumBuild: 3, androidLatestVersion: "1.0.4" });
  });

  it("advances only the latest build from release automation after token authentication", async () => {
    const denied = await request(app)
      .post("/api/v1/internal/release-policy/android/latest")
      .send({ latestBuild: 4, latestVersion: "1.0.4" });
    expect(denied.status).toBe(401);

    const sync = await request(app)
      .post("/api/v1/internal/release-policy/android/latest")
      .set("x-noteschain-release-policy-token", releasePolicyToken)
      .send({ latestBuild: 4, latestVersion: "1.0.4" });
    expect(sync.status).toBe(200);
    expect(sync.body).toEqual({
      data: {
        android: { latestBuild: 4, minimumBuild: 1, latestVersion: "1.0.4" },
        changed: true,
      },
    });

    const staleRetry = await request(app)
      .post("/api/v1/internal/release-policy/android/latest")
      .set("x-noteschain-release-policy-token", releasePolicyToken)
      .send({ latestBuild: 3, latestVersion: "1.0.3" });
    expect(staleRetry.status).toBe(200);
    expect(staleRetry.body.data.changed).toBe(false);

    const publicPolicy = await request(app).get("/api/v1/app/version");
    expect(publicPolicy.body.data.android).toEqual({ latestBuild: 4, minimumBuild: 1, latestVersion: "1.0.4" });
  });
});
