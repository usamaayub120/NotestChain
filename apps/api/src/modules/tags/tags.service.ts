import { prisma } from "../../lib/prisma.js";

export interface TagCount {
  tag: string;
  count: number;
}

export async function listTags(limit = 50): Promise<TagCount[]> {
  const rows = await prisma.$queryRaw<{ tag: string; count: bigint }[]>`
    SELECT unnest("tags") AS tag, count(*) AS count
    FROM "Publication"
    WHERE "isPlatformVisible" = true
      AND "discoverability" = 'PUBLIC'
      AND "status" IN ('CHAIN_PENDING', 'CHAIN_SUBMITTED', 'PUBLISHED')
    GROUP BY tag
    ORDER BY count DESC, tag ASC
    LIMIT ${limit}
  `;
  return rows.map((row) => ({ tag: row.tag, count: Number(row.count) }));
}
