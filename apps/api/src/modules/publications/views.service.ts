import type { RecordPublicationViewInput } from "@noteschain/validation";
import { prisma } from "../../lib/prisma.js";
import { Errors } from "../../lib/apiError.js";

export async function recordView(publicationId: string, input: RecordPublicationViewInput, referrerHost?: string) {
  const publication = await prisma.publication.findUnique({ where: { id: publicationId } });
  if (!publication || !publication.isPlatformVisible) {
    throw Errors.notFound("Publication not found.");
  }

  await prisma.publicationView.create({
    data: {
      publicationId,
      utmSource: input.utmSource,
      utmMedium: input.utmMedium,
      utmCampaign: input.utmCampaign,
      referrerHost,
    },
  });
}
