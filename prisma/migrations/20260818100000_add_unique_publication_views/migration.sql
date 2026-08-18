-- Existing rows are intentionally left with a NULL visitorHash: they are
-- historic raw pageviews and cannot be truthfully converted into uniques.
ALTER TABLE "PublicationView" ADD COLUMN "visitorHash" TEXT;

CREATE UNIQUE INDEX "PublicationView_publicationId_visitorHash_key"
  ON "PublicationView"("publicationId", "visitorHash");
