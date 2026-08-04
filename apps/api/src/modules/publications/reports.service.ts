import { prisma } from "../../lib/prisma.js";
import { Errors } from "../../lib/apiError.js";

export async function createReport(publicationId: string, reporterUserId: string, reason: string) {
  const publication = await prisma.publication.findUnique({ where: { id: publicationId } });
  if (!publication || !publication.isPlatformVisible) {
    throw Errors.notFound("Publication not found.");
  }
  return prisma.report.create({ data: { publicationId, reporterUserId, reason } });
}
