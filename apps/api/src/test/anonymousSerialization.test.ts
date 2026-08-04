import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createApp } from "../app.js";
import { prisma } from "../lib/prisma.js";
import { registerAndLogin, resetTestDb } from "./helpers.js";

const app = createApp();

/**
 * Anonymous means anonymous-to-readers-not-to-the-platform (see
 * ARCHITECTURE.md §2) — the DB always keeps privateAuthorUserId, but the
 * public read paths must never surface it, the linked email, or any
 * identity that would de-anonymize the author.
 */
describe("anonymous publication serialization", () => {
  let anonymousPublicationId: string;
  let namedPublicationId: string;
  let authorEmail: string;
  let authorUserId: string;

  beforeAll(async () => {
    await resetTestDb();
    const author = await registerAndLogin(app);
    authorUserId = author.userId;
    const user = await prisma.user.findUniqueOrThrow({ where: { id: authorUserId } });
    authorEmail = user.email;

    const identity = await prisma.publicIdentity.create({
      data: { userId: authorUserId, type: "PSEUDONYM", username: "quiet-writer", displayName: "Quiet Writer" },
    });

    const anon = await prisma.publication.create({
      data: {
        privateAuthorUserId: authorUserId,
        identityMode: "ANONYMOUS",
        discoverability: "PUBLIC",
        title: "A secret",
        content: "Nobody knows this is me.",
        excerpt: "Nobody knows...",
        contentHash: "deadbeef",
        status: "PUBLISHED",
      },
    });
    anonymousPublicationId = anon.id;

    const named = await prisma.publication.create({
      data: {
        privateAuthorUserId: authorUserId,
        publicIdentityId: identity.id,
        identityMode: "PSEUDONYMOUS",
        discoverability: "PUBLIC",
        title: "A signed thought",
        content: "This one I'll own.",
        excerpt: "This one...",
        contentHash: "cafebabe",
        status: "PUBLISHED",
      },
    });
    namedPublicationId = named.id;
  });

  afterAll(async () => {
    await resetTestDb();
    await prisma.$disconnect();
  });

  it("never includes privateAuthorUserId, the author's email, or a real identity for an ANONYMOUS publication", async () => {
    const res = await request(app).get(`/api/v1/publications/${anonymousPublicationId}`);
    expect(res.status).toBe(200);

    const raw = JSON.stringify(res.body);
    expect(raw).not.toContain(authorUserId);
    expect(raw).not.toContain(authorEmail);
    expect(res.body.data.author).toBeNull();
  });

  it("also never leaks the author on the list endpoint", async () => {
    const res = await request(app).get("/api/v1/publications");
    expect(res.status).toBe(200);

    const raw = JSON.stringify(res.body);
    expect(raw).not.toContain(authorUserId);
    expect(raw).not.toContain(authorEmail);

    const anonEntry = res.body.data.find((p: { id: string }) => p.id === anonymousPublicationId);
    expect(anonEntry.author).toBeNull();
  });

  it("does show the linked public identity (not the private user) for a non-anonymous publication", async () => {
    const res = await request(app).get(`/api/v1/publications/${namedPublicationId}`);
    expect(res.status).toBe(200);
    expect(res.body.data.author).toMatchObject({ username: "quiet-writer", displayName: "Quiet Writer" });

    const raw = JSON.stringify(res.body);
    expect(raw).not.toContain(authorUserId);
    expect(raw).not.toContain(authorEmail);
  });
});
