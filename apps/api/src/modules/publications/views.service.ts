import { createHash } from "node:crypto";
import type { RecordPublicationViewInput } from "@noteschain/validation";
import { prisma } from "../../lib/prisma.js";
import { Errors } from "../../lib/apiError.js";

export function hashVisitorToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export async function recordView(
  publicationId: string,
  input: RecordPublicationViewInput,
  visitorHash: string,
  viewerUserId?: string,
  referrerHost?: string,
) {
  const publication = await prisma.publication.findUnique({ where: { id: publicationId } });
  if (!publication || !publication.isPlatformVisible) {
    throw Errors.notFound("Publication not found.");
  }

  // A writer checking their own note should not inflate its reader count.
  if (viewerUserId && publication.privateAuthorUserId === viewerUserId) {
    return { recorded: false, reason: "author" as const };
  }

  const result = await prisma.publicationView.createMany({
    data: {
      publicationId,
      utmSource: input.utmSource,
      utmMedium: input.utmMedium,
      utmCampaign: input.utmCampaign,
      referrerHost,
      visitorHash,
    },
    skipDuplicates: true,
  });

  return { recorded: result.count === 1, reason: result.count === 1 ? undefined : ("duplicate" as const) };
}
