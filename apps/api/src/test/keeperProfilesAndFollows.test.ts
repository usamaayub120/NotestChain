import request from "supertest";
import { afterAll, describe, expect, it } from "vitest";
import { createApp } from "../app.js";
import { prisma } from "../lib/prisma.js";
import { registerAndLogin, resetTestDb } from "./helpers.js";

const app = createApp();

describe("Keeper profiles", () => {
  afterAll(async () => {
    await resetTestDb();
    await prisma.$disconnect();
  });

  it("gives every new account exactly one primary identity, matching its username", async () => {
    const keeper = await registerAndLogin(app, undefined, { username: "marguerite", displayName: "Marguerite Vale" });
    const identities = await prisma.publicIdentity.findMany({ where: { userId: keeper.userId } });
    expect(identities).toHaveLength(1);
    expect(identities[0]).toMatchObject({
      isPrimary: true,
      username: "marguerite",
      displayName: "Marguerite Vale",
      type: "REAL_NAME",
    });
  });

  it("rejects a taken username at registration rather than silently renaming it", async () => {
    await registerAndLogin(app, undefined, { username: "taken-handle" });
    const res = await request(app)
      .post("/api/v1/auth/register")
      .send({
        email: `dupe-${Date.now()}@noteschain.test`,
        password: "a-strong-test-password-1",
        captchaToken: "test-bypass-token",
        acceptedTerms: true,
        username: "taken-handle",
      });
    expect(res.status).toBe(409);
  });

  it("generates a username from the email when the client sends none, for an old mobile binary", async () => {
    const email = `pat.reader.${Date.now()}@noteschain.test`;
    const res = await request(app)
      .post("/api/v1/auth/mobile/register")
      .send({ email, password: "a-strong-test-password-1", captchaToken: "test-bypass-token", acceptedTerms: true });
    expect(res.status).toBe(201);
    expect(res.body.data.user.primaryIdentity.username).toMatch(/^pat-reader/);
    // Generated, not chosen — the one free rename is still owed.
    expect(res.body.data.user.primaryIdentity.canChangeUsername).toBe(true);
  });

  it("never lets the Keeper profile be deleted", async () => {
    const keeper = await registerAndLogin(app);
    const identity = await prisma.publicIdentity.findFirstOrThrow({ where: { userId: keeper.userId, isPrimary: true } });
    const res = await keeper.agent.delete(`/api/v1/identities/${identity.id}`).set("x-csrf-token", keeper.csrfToken);
    expect(res.status).toBe(400);
  });

  it("never lets the Keeper profile be hidden", async () => {
    const keeper = await registerAndLogin(app);
    const identity = await prisma.publicIdentity.findFirstOrThrow({ where: { userId: keeper.userId, isPrimary: true } });
    const res = await keeper.agent
      .patch(`/api/v1/identities/${identity.id}`)
      .set("x-csrf-token", keeper.csrfToken)
      .send({ isVisible: false });
    expect(res.status).toBe(400);
  });

  it("keeps a pen name hideable, unlike the Keeper profile", async () => {
    const keeper = await registerAndLogin(app);
    const created = await keeper.agent
      .post("/api/v1/identities")
      .set("x-csrf-token", keeper.csrfToken)
      .send({ username: `pen-${Date.now()}`, displayName: "Night Wire" });
    expect(created.status).toBe(201);
    const res = await keeper.agent
      .patch(`/api/v1/identities/${created.body.data.id}`)
      .set("x-csrf-token", keeper.csrfToken)
      .send({ isVisible: false });
    expect(res.status).toBe(200);
    expect(res.body.data.isVisible).toBe(false);
  });
});

describe("follows: privacy rules", () => {
  afterAll(async () => {
    await resetTestDb();
    await prisma.$disconnect();
  });

  it("lets a Keeper follow another Keeper's profile and see it reflected on that profile", async () => {
    const follower = await registerAndLogin(app);
    const target = await registerAndLogin(app);

    const followRes = await follower.agent
      .post(`/api/v1/follows/${target.username}`)
      .set("x-csrf-token", follower.csrfToken);
    expect(followRes.status).toBe(200);

    const profile = await follower.agent.get(`/api/v1/profiles/${target.username}`);
    expect(profile.body.data.isFollowing).toBe(true);
  });

  it("refuses to let a Keeper follow their own byline", async () => {
    const keeper = await registerAndLogin(app);
    const res = await keeper.agent.post(`/api/v1/follows/${keeper.username}`).set("x-csrf-token", keeper.csrfToken);
    expect(res.status).toBe(400);
  });

  it("queues a NEW_FOLLOWER push for the target, naming the follower's own Keeper profile", async () => {
    const follower = await registerAndLogin(app);
    const target = await registerAndLogin(app);

    await follower.agent.post(`/api/v1/follows/${target.username}`).set("x-csrf-token", follower.csrfToken);

    const job = await prisma.pushJob.findFirstOrThrow({ where: { userId: target.userId, kind: "NEW_FOLLOWER" } });
    const data = job.data as { followerUsername: string; targetUsername: string };
    expect(data.followerUsername).toBe(follower.username);
    expect(data.targetUsername).toBe(target.username);
  });

  it("does not queue a second push when an already-following request repeats", async () => {
    const follower = await registerAndLogin(app);
    const target = await registerAndLogin(app);

    await follower.agent.post(`/api/v1/follows/${target.username}`).set("x-csrf-token", follower.csrfToken);
    await follower.agent.post(`/api/v1/follows/${target.username}`).set("x-csrf-token", follower.csrfToken);

    const jobs = await prisma.pushJob.findMany({ where: { userId: target.userId, kind: "NEW_FOLLOWER" } });
    expect(jobs).toHaveLength(1);
  });

  it("never exposes a follower list — only a fuzzed count", async () => {
    const target = await registerAndLogin(app);
    const targetIdentity = await prisma.publicIdentity.findFirstOrThrow({ where: { userId: target.userId, isPrimary: true } });

    // Three followers is below the visibility threshold: the profile must
    // show "not yet visible" (null), never the exact small number, and there
    // is no endpoint anywhere that returns the follower list itself.
    for (let i = 0; i < 3; i += 1) {
      const follower = await registerAndLogin(app);
      await follower.agent.post(`/api/v1/follows/${target.username}`).set("x-csrf-token", follower.csrfToken);
    }

    const profile = await request(app).get(`/api/v1/profiles/${target.username}`);
    expect(profile.body.data.followerCount).toBeNull();

    const raw = JSON.stringify(profile.body);
    expect(raw).not.toContain(targetIdentity.userId);
  });

  it("keeps a Keeper's own following list visible only to that Keeper", async () => {
    const follower = await registerAndLogin(app);
    const target = await registerAndLogin(app);
    await follower.agent.post(`/api/v1/follows/${target.username}`).set("x-csrf-token", follower.csrfToken);

    const own = await follower.agent.get("/api/v1/follows/mine");
    expect(own.status).toBe(200);
    expect(own.body.data).toHaveLength(1);
    expect(own.body.data[0].username).toBe(target.username);

    // No endpoint takes an arbitrary user id or username and returns THEIR
    // following list — /follows/mine is always the requester's own.
    const stranger = await registerAndLogin(app);
    const strangerView = await stranger.agent.get("/api/v1/follows/mine");
    expect(strangerView.body.data).toHaveLength(0);

    const unauthenticated = await request(app).get("/api/v1/follows/mine");
    expect(unauthenticated.status).toBe(401);
  });

  it("never returns PublicIdentity.userId from any follow-related response", async () => {
    const follower = await registerAndLogin(app);
    const target = await registerAndLogin(app);
    const targetIdentity = await prisma.publicIdentity.findFirstOrThrow({ where: { userId: target.userId, isPrimary: true } });
    await follower.agent.post(`/api/v1/follows/${target.username}`).set("x-csrf-token", follower.csrfToken);

    const mine = await follower.agent.get("/api/v1/follows/mine");
    expect(JSON.stringify(mine.body)).not.toContain(targetIdentity.userId);

    const profile = await request(app).get(`/api/v1/profiles/${target.username}`);
    expect(JSON.stringify(profile.body)).not.toContain(targetIdentity.userId);
  });
});

describe("people search", () => {
  afterAll(async () => {
    await resetTestDb();
    await prisma.$disconnect();
  });

  it("always finds a Keeper profile", async () => {
    const username = `s-keeper-${Date.now() % 100_000}`;
    const keeper = await registerAndLogin(app, undefined, { username });
    const res = await request(app).get("/api/v1/search/people").query({ q: "s-keeper" });
    expect(res.status).toBe(200);
    expect(res.body.data.some((r: { username: string }) => r.username === keeper.username)).toBe(true);
  });

  it("hides a pen name once its owner turns off public visibility", async () => {
    const keeper = await registerAndLogin(app);
    const penName = `hidden-pen-${Date.now()}`;
    const created = await keeper.agent
      .post("/api/v1/identities")
      .set("x-csrf-token", keeper.csrfToken)
      .send({ username: penName, displayName: "Quiet Voice" });
    await keeper.agent
      .patch(`/api/v1/identities/${created.body.data.id}`)
      .set("x-csrf-token", keeper.csrfToken)
      .send({ isVisible: false });

    const res = await request(app).get("/api/v1/search/people").query({ q: penName });
    expect(res.body.data).toHaveLength(0);
  });

  it("never returns userId in a people-search result", async () => {
    const keeper = await registerAndLogin(app, undefined, { username: `no-leak-${Date.now()}` });
    const res = await request(app).get("/api/v1/search/people").query({ q: "no-leak" });
    expect(JSON.stringify(res.body)).not.toContain(keeper.userId);
  });
});
