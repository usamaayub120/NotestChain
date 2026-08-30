import request from "supertest";
import { describe, expect, it } from "vitest";
import { createApp } from "../app.js";
import { env } from "../config/env.js";

const app = createApp();

describe("mobile app version policy", () => {
  it("returns the public Android build policy without authentication", async () => {
    const response = await request(app).get("/api/v1/app/version");

    expect(response.status).toBe(200);
    expect(response.headers["cache-control"]).toContain("no-store");
    expect(response.body).toEqual({
      data: {
        android: {
          latestBuild: env.ANDROID_LATEST_BUILD,
          minimumBuild: env.ANDROID_MINIMUM_BUILD,
          latestVersion: env.ANDROID_LATEST_VERSION,
        },
      },
    });
  });
});
