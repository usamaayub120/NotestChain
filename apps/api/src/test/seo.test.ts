import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { Discoverability, IdentityMode, Role } from "@noteschain/shared";
import type { SiteSettings } from "@prisma/client";
import { createApp } from "../app.js";
import { prisma } from "../lib/prisma.js";
import { getPublicationById } from "../modules/publications/publications.service.js";
import { buildHomeHead, buildPublicationHead } from "../modules/seo/seo.service.js";
import { promoteRole, registerAndLogin, resetTestDb, type TestSession } from "./helpers.js";

const app = createApp();

const baseSettings: SiteSettings = {
  id: 1,
  ga4MeasurementId: null,
  searchConsoleVerification: null,
  defaultMetaDescription: null,
  defaultOgImageUrl: null,
  twitterHandle: null,
  indexingEnabled: true,
  androidLatestBuild: 1,
  androidMinimumBuild: 1,
  androidLatestVersion: "1.0.0",
  updatedAt: new Date(),
};

describe("SEO", () => {
  let admin: TestSession;

  beforeAll(async () => {
    await resetTestDb();
    admin = await registerAndLogin(app);
    await promoteRole(admin.userId, Role.ADMIN);
  });

  afterAll(async () => {
    await resetTestDb();
    await prisma.$disconnect();
  });

  describe("per-publication head tags", () => {
    it("never leaks the author of an anonymous publication", async () => {
      const author = await registerAndLogin(app);
      const identity = await prisma.publicIdentity.create({
        data: {
          userId: author.userId,
          type: "PSEUDONYM",
          username: `hidden-${Date.now()}`,
          displayName: "Should Not Appear",
        },
      });
      const publication = await prisma.publication.create({
        data: {
          privateAuthorUserId: author.userId,
          // Set on the row on purpose: identityMode ANONYMOUS must redact it
          // regardless of whether a publicIdentity happens to be attached.
          publicIdentityId: identity.id,
          identityMode: IdentityMode.ANONYMOUS,
          discoverability: Discoverability.PUBLIC,
          title: "A private thought",
          content: "Nobody should know who wrote this.",
          excerpt: "Nobody should know who wrote this.",
          contentHash: "seo-anon-test",
          status: "PUBLISHED",
        },
      });

      const dto = await getPublicationById(publication.id);
      const head = buildPublicationHead(dto, baseSettings);

      expect(head).not.toContain("Should Not Appear");
      expect(head).not.toContain(identity.username);
      expect(head).toContain("A private thought");
    });

    it("marks an unlisted note noindex and skips structured data, but still renders shareable OG tags", async () => {
      const author = await registerAndLogin(app);
      const publication = await prisma.publication.create({
        data: {
          privateAuthorUserId: author.userId,
          identityMode: IdentityMode.ANONYMOUS,
          discoverability: Discoverability.UNLISTED,
          title: "Unlisted note",
          content: "Shareable, not indexable.",
          excerpt: "Shareable, not indexable.",
          contentHash: "seo-unlisted-test",
          status: "PUBLISHED",
        },
      });

      const dto = await getPublicationById(publication.id);
      const head = buildPublicationHead(dto, baseSettings);

      expect(head).toContain('name="robots" content="noindex');
      expect(head).toContain("Unlisted note");
      expect(head).toContain("og:title");
      expect(head).not.toContain("application/ld+json");
    });

    it("forces noindex sitewide when indexingEnabled is off, even for an otherwise-public route", () => {
      const head = buildHomeHead({ ...baseSettings, indexingEnabled: false });
      expect(head).toContain('name="robots" content="noindex');
    });
  });

  describe("sitemap.xml", () => {
    it("lists only publicly visible, discoverable publications", async () => {
      const author = await registerAndLogin(app);
      const common = {
        privateAuthorUserId: author.userId,
        identityMode: IdentityMode.ANONYMOUS,
        content: "x",
        excerpt: "x",
        status: "PUBLISHED" as const,
      };
      const visible = await prisma.publication.create({
        data: { ...common, discoverability: Discoverability.PUBLIC, title: "Visible", contentHash: "sitemap-visible" },
      });
      const unlisted = await prisma.publication.create({
        data: { ...common, discoverability: Discoverability.UNLISTED, title: "Hidden", contentHash: "sitemap-unlisted" },
      });
      const delisted = await prisma.publication.create({
        data: {
          ...common,
          discoverability: Discoverability.PUBLIC,
          isPlatformVisible: false,
          title: "Delisted",
          contentHash: "sitemap-delisted",
        },
      });

      const res = await request(app).get("/sitemap.xml");
      expect(res.status).toBe(200);
      expect(res.text).toContain(`/p/${visible.id}`);
      expect(res.text).not.toContain(`/p/${unlisted.id}`);
      expect(res.text).not.toContain(`/p/${delisted.id}`);
    });
  });

  describe("robots.txt", () => {
    it("disallows everything once an admin turns indexing off, and re-allows it back on", async () => {
      const off = await admin.agent
        .patch("/api/v1/admin/settings")
        .set("x-csrf-token", admin.csrfToken)
        .send({ indexingEnabled: false });
      expect(off.status).toBe(200);

      const disallowed = await request(app).get("/robots.txt");
      expect(disallowed.text).toContain("Disallow: /");
      expect(disallowed.text).not.toContain("Allow: /");

      const on = await admin.agent
        .patch("/api/v1/admin/settings")
        .set("x-csrf-token", admin.csrfToken)
        .send({ indexingEnabled: true });
      expect(on.status).toBe(200);

      const allowed = await request(app).get("/robots.txt");
      expect(allowed.text).toContain("Allow: /");
      expect(allowed.text).toContain("Sitemap:");
    });
  });

  describe("raw impressions vs. unique readers", () => {
    it("increments impressionCount on every view, unlike the deduplicated unique-reader count", async () => {
      const author = await registerAndLogin(app);
      const publication = await prisma.publication.create({
        data: {
          privateAuthorUserId: author.userId,
          identityMode: IdentityMode.ANONYMOUS,
          discoverability: Discoverability.PUBLIC,
          title: "Impression test",
          content: "x",
          excerpt: "x",
          contentHash: "impression-test",
          status: "PUBLISHED",
        },
      });

      const browser = request.agent(app);
      await browser.post(`/api/v1/publications/${publication.id}/view`).send({});
      await browser.post(`/api/v1/publications/${publication.id}/view`).send({}); // same visitor, dedup'd
      await request(app).post(`/api/v1/publications/${publication.id}/view`).send({}); // a second visitor

      const updated = await prisma.publication.findUniqueOrThrow({ where: { id: publication.id } });
      const uniqueReaders = await prisma.publicationView.count({ where: { publicationId: publication.id, visitorHash: { not: null } } });

      expect(updated.impressionCount).toBe(3);
      expect(uniqueReaders).toBe(2);
    });
  });
});
