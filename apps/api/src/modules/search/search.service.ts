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
  // Two deliberate choices here.
  //
  // "contentPlain", not "content": ts_headline inlines <b> markers into the
  // text it is given, and sanitizeHeadline() below escapes everything then
  // restores exactly those markers. Handing it raw markdown would put
  // literal `**` into search snippets and leave the asterisks stranded
  // around a highlighted word.
  //
  // left(..., 20000): ts_headline re-tokenizes the whole document per row.
  // That was free when a note was 600 bytes; at 20,000 characters across a
  // page of results it is not. The cost of the cap is that a match past the
  // first 20k characters of a very long note gets no snippet fragment.
  const headlineSelect = tsquery
    ? Prisma.sql`ts_headline('english', left(p."contentPlain", 20000), ${tsquery}, 'MaxWords=35, MinWords=15, MaxFragments=1')`
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

export interface PersonSearchResult {
  username: string;
  displayName: string;
  avatarUrl: string | null;
  bio: string;
  isPrimary: boolean;
  publicationCount: number;
}

/**
 * Keeper/pen-name search by handle or display name.
 *
 * A Keeper profile is always findable — a person's own name is already on
 * every byline they write, so hiding it from search would just make people
 * search harder to use without protecting anything. A pen name is findable
 * only when its owner has left it visible, the same "show publicly" toggle
 * that already governs whether it appears on the wider site. Never returns
 * PublicIdentity.userId or anything else that could link two results
 * together — see the leak-analysis rules in identities.service.ts.
 */
export async function searchPeople(q: string, page: number, pageSize: number): Promise<{ items: PersonSearchResult[]; total: number }> {
  const where = {
    OR: [{ isPrimary: true }, { isVisible: true }],
    AND: {
      OR: [
        { username: { contains: q, mode: "insensitive" as const } },
        { displayName: { contains: q, mode: "insensitive" as const } },
      ],
    },
  };

  const [identities, total] = await Promise.all([
    prisma.publicIdentity.findMany({
      where,
      orderBy: [{ isPrimary: "desc" }, { username: "asc" }],
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.publicIdentity.count({ where }),
  ]);

  if (identities.length === 0) return { items: [], total };

  const counts = await prisma.publication.groupBy({
    by: ["publicIdentityId"],
    where: { publicIdentityId: { in: identities.map((i) => i.id) }, isPlatformVisible: true, discoverability: "PUBLIC" },
    _count: { _all: true },
  });
  const countByIdentity = new Map(counts.map((c) => [c.publicIdentityId, c._count._all]));

  return {
    items: identities.map((identity) => ({
      username: identity.username,
      displayName: identity.displayName,
      avatarUrl: identity.avatarUrl,
      bio: identity.bio,
      isPrimary: identity.isPrimary,
      publicationCount: countByIdentity.get(identity.id) ?? 0,
    })),
    total,
  };
}
