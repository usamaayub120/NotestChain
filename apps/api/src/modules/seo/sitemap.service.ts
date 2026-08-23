import { Discoverability } from "@noteschain/shared";
import { prisma } from "../../lib/prisma.js";
import { env } from "../../config/env.js";
import { PUBLICLY_VISIBLE_STATUSES } from "../publications/publications.service.js";

// The sitemap protocol's own hard cap on <url> entries per file — this
// platform is nowhere near it, but the query stays capped defensively
// rather than growing unbounded. Splitting into a sitemap index is a
// problem for whenever this limit actually gets close.
const SITEMAP_URL_LIMIT = 50_000;
const STATIC_PATHS = ["/", "/explore", "/how-it-works"];

const publicationWhere = {
  isPlatformVisible: true,
  discoverability: Discoverability.PUBLIC,
  status: { in: [...PUBLICLY_VISIBLE_STATUSES] },
};

function urlEntry(loc: string, lastmod?: Date | null): string {
  const lastmodTag = lastmod ? `<lastmod>${lastmod.toISOString()}</lastmod>` : "";
  return `<url><loc>${loc}</loc>${lastmodTag}</url>`;
}

/**
 * Deliberately doesn't enumerate /tags/:tag pages — every note already
 * links to its own tags (see PublicationReaderPage.tsx), so crawlers reach
 * them without an extra join query here.
 */
export async function buildSitemapXml(): Promise<string> {
  const origin = env.PUBLIC_WEB_ORIGIN.replace(/\/$/, "");

  const publications = await prisma.publication.findMany({
    where: publicationWhere,
    select: { id: true, updatedAt: true },
    orderBy: { publishedAt: "desc" },
    take: SITEMAP_URL_LIMIT - STATIC_PATHS.length,
  });

  const remaining = SITEMAP_URL_LIMIT - STATIC_PATHS.length - publications.length;
  const identities =
    remaining > 0
      ? await prisma.publicIdentity.findMany({
          where: { isVisible: true, publications: { some: publicationWhere } },
          select: { username: true, updatedAt: true },
          take: remaining,
        })
      : [];

  const urls = [
    ...STATIC_PATHS.map((path) => urlEntry(`${origin}${path}`)),
    ...publications.map((pub) => urlEntry(`${origin}/p/${pub.id}`, pub.updatedAt)),
    ...identities.map((identity) => urlEntry(`${origin}/@${identity.username}`, identity.updatedAt)),
  ];

  return (
    `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.join("\n")}\n</urlset>`
  );
}
