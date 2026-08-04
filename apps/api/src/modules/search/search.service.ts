import { Prisma } from "@prisma/client";
import type { SearchQueryInput } from "@noteschain/validation";
import { prisma } from "../../lib/prisma.js";
import { PUBLICLY_VISIBLE_STATUSES, toPublicationDTO } from "../publications/publications.service.js";

interface SearchRow {
  id: string;
  rank: number | null;
  headline: string | null;
}

type SearchResultItem = ReturnType<typeof toPublicationDTO> & { highlight: string | null };

export interface SearchResult {
  items: SearchResultItem[];
  total: number;
}

const HTML_ESCAPES: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;",
};

/**
 * ts_headline() inlines its own literal <b>/</b> markers directly into the
 * (untrusted, user-authored) publication text. Escape everything as plain
 * text first, then restore only those two exact marker tags — never trust
 * ts_headline's output as HTML on its own, or a title/body containing
 * "<script>" would render as one on the client.
 */
function sanitizeHeadline(headline: string): string {
  const escaped = headline.replace(/[&<>"']/g, (ch) => HTML_ESCAPES[ch]!);
  return escaped.replace(/&lt;b&gt;/g, "<b>").replace(/&lt;\/b&gt;/g, "</b>");
}

export async function searchPublications(query: SearchQueryInput): Promise<SearchResult> {
  const conditions: Prisma.Sql[] = [
    Prisma.sql`p."isPlatformVisible" = true`,
    Prisma.sql`p."discoverability"::text = 'PUBLIC'`,
    // See publications.service.ts: Phase 2 keeps this consistent with the
    // general read model (not PUBLISHED-only yet) so search is testable
    // before the worker exists. TODO(Phase 4/5): restrict to 'PUBLISHED'
    // only, per product spec §16 ("finalized publications").
    Prisma.sql`p."status"::text IN (${Prisma.join(PUBLICLY_VISIBLE_STATUSES)})`,
  ];

  if (query.tag) conditions.push(Prisma.sql`p."tags" @> ARRAY[${query.tag}]::text[]`);
  if (query.identityMode) conditions.push(Prisma.sql`p."identityMode"::text = ${query.identityMode}`);
  if (query.from) conditions.push(Prisma.sql`p."createdAt" >= ${query.from}`);
  if (query.to) conditions.push(Prisma.sql`p."createdAt" <= ${query.to}`);
  if (query.author) {
    conditions.push(
      Prisma.sql`EXISTS (
        SELECT 1 FROM "PublicIdentity" pi
        WHERE pi."id" = p."publicIdentityId"
          AND (pi."username" ILIKE ${`%${query.author}%`} OR pi."displayName" ILIKE ${`%${query.author}%`})
      )`,
    );
  }

  const tsquery = query.q ? Prisma.sql`websearch_to_tsquery('english', ${query.q})` : null;
  if (tsquery) {
    conditions.push(Prisma.sql`p."searchVector" @@ ${tsquery}`);
  }

  const whereClause = Prisma.join(conditions, " AND ");

  const orderClause =
    query.sort === "oldest"
      ? Prisma.sql`p."createdAt" ASC`
      : query.sort === "newest"
        ? Prisma.sql`p."createdAt" DESC`
        : tsquery
          ? Prisma.sql`ts_rank(p."searchVector", ${tsquery}) DESC, p."createdAt" DESC`
          : Prisma.sql`p."createdAt" DESC`;

  const rankSelect = tsquery ? Prisma.sql`ts_rank(p."searchVector", ${tsquery})` : Prisma.sql`NULL`;
  const headlineSelect = tsquery
    ? Prisma.sql`ts_headline('english', p."content", ${tsquery}, 'MaxWords=35, MinWords=15, MaxFragments=1')`
    : Prisma.sql`NULL`;

  const offset = (query.page - 1) * query.pageSize;

  const [rows, countRows] = await Promise.all([
    prisma.$queryRaw<SearchRow[]>`
      SELECT p."id" AS id, ${rankSelect} AS rank, ${headlineSelect} AS headline
      FROM "Publication" p
      WHERE ${whereClause}
      ORDER BY ${orderClause}
      LIMIT ${query.pageSize} OFFSET ${offset}
    `,
    prisma.$queryRaw<{ count: bigint }[]>`
      SELECT count(*) AS count FROM "Publication" p WHERE ${whereClause}
    `,
  ]);

  if (rows.length === 0) {
    return { items: [], total: Number(countRows[0]?.count ?? 0) };
  }

  const publications = await prisma.publication.findMany({
    where: { id: { in: rows.map((r) => r.id) } },
    include: { publicIdentity: true, chainRecord: true },
  });
  const byId = new Map(publications.map((p) => [p.id, p]));

  const items: SearchResultItem[] = rows
    .map((row) => {
      const pub = byId.get(row.id);
      if (!pub) return null;
      return { ...toPublicationDTO(pub), highlight: row.headline ? sanitizeHeadline(row.headline) : null };
    })
    .filter((item): item is SearchResultItem => item !== null);

  return { items, total: Number(countRows[0]?.count ?? 0) };
}
