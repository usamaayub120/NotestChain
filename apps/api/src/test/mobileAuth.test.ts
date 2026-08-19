import request from "supertest";
import { beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../app.js";
import { resetTestDb } from "./helpers.js";

const app = createApp();

describe("mobile bearer sessions", () => {
  beforeEach(resetTestDb);

  it("issues a MOBILE session that authenticates bearer requests without CSRF", async () => {
    const registration = await request(app).post("/api/v1/auth/mobile/register").send({
      email: "native@example.test", password: "a-strong-test-password", captchaToken: "test-bypass-token", deviceName: "Pixel",
    });
    expect(registration.status).toBe(201);
    const token = registration.body.data.session.token;
    expect(token).toEqual(expect.any(String));
    expect(registration.headers["set-cookie"]).toBeUndefined();

    const me = await request(app).get("/api/v1/auth/me").set("authorization", `Bearer ${token}`);
    expect(me.status).toBe(200);
    expect(me.body.data.user.email).toBe("native@example.test");

    const refreshed = await request(app).post("/api/v1/auth/mobile/refresh").set("authorization", `Bearer ${token}`);
    expect(refreshed.status).toBe(200);
    expect(refreshed.body.data.session.token).not.toBe(token);
  });

  it("does not accept a browser session as a bearer token", async () => {
    const registration = await request(app).post("/api/v1/auth/register").send({ email: "web@example.test", password: "a-strong-test-password", captchaToken: "test-bypass-token" });
    const setCookie = registration.headers["set-cookie"];
    const cookies = Array.isArray(setCookie) ? setCookie : setCookie ? [setCookie] : [];
    const cookie = cookies.find((value) => value.startsWith("nc_session="));
    const token = /nc_session=([^;]+)/.exec(cookie)?.[1];
    const response = await request(app).get("/api/v1/auth/me").set("authorization", `Bearer ${token}`);
    expect(response.status).toBe(401);
  });
});
