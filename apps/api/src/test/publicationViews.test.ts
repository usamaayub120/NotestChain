import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createApp } from "../app.js";
import { prisma } from "../lib/prisma.js";
import { registerAndLogin, resetTestDb } from "./helpers.js";

const app = createApp();

describe("unique publication readers", () => {
  let publicationId: string;
  let authorId: string;

  beforeAll(async () => {
    await resetTestDb();
    const author = await registerAndLogin(app);
    authorId = author.userId;
    const publication = await prisma.publication.create({
      data: {
        privateAuthorUserId: authorId, identityMode: "ANONYMOUS", discoverability: "PUBLIC",
        title: "A note", content: "A permanent thought.", excerpt: "A permanent thought.", contentHash: "view-test", status: "PUBLISHED",
      },
    });
    publicationId = publication.id;
  });

  afterAll(async () => { await resetTestDb(); await prisma.$disconnect(); });

  it("records one reader per browser cookie and a new reader for another browser", async () => {
    const firstBrowser = request.agent(app);
    const first = await firstBrowser.post(`/api/v1/publications/${publicationId}/view`).send({ utmSource: "newsletter" });
    expect(first.status).toBe(202); expect(first.body.data.recorded).toBe(true);
    const repeat = await firstBrowser.post(`/api/v1/publications/${publicationId}/view`).send({ utmSource: "newsletter" });
    expect(repeat.status).toBe(202); expect(repeat.body.data.recorded).toBe(false);
    const secondBrowser = await request(app).post(`/api/v1/publications/${publicationId}/view`).send({});
    expect(secondBrowser.status).toBe(202); expect(secondBrowser.body.data.recorded).toBe(true);
    expect(await prisma.publicationView.count({ where: { publicationId, visitorHash: { not: null } } })).toBe(2);
  });

  it("does not count a signed-in author viewing their own note", async () => {
    const author = await registerAndLogin(app);
    await prisma.publication.update({ where: { id: publicationId }, data: { privateAuthorUserId: author.userId } });
    const response = await author.agent.post(`/api/v1/publications/${publicationId}/view`).set("x-csrf-token", author.csrfToken).send({});
    expect(response.status).toBe(202); expect(response.body.data).toEqual({ recorded: false, reason: "author" });
  });

  it("returns only the signed-in writer's published analytics", async () => {
    const author = await registerAndLogin(app);
    const other = await registerAndLogin(app);
    await prisma.publication.update({ where: { id: publicationId }, data: { privateAuthorUserId: author.userId } });
    const own = await author.agent.get("/api/v1/publications/mine/analytics");
    expect(own.status).toBe(200); expect(own.body.data).toHaveLength(1); expect(own.body.data[0].uniqueReaders).toBe(2);
    const hidden = await other.agent.get("/api/v1/publications/mine/analytics");
    expect(hidden.status).toBe(200); expect(hidden.body.data).toHaveLength(0);
  });
});
