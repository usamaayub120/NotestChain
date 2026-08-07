-- CreateTable
CREATE TABLE "PublicationView" (
    "id" TEXT NOT NULL,
    "publicationId" TEXT NOT NULL,
    "utmSource" TEXT,
    "utmMedium" TEXT,
    "utmCampaign" TEXT,
    "referrerHost" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PublicationView_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PublicationView_publicationId_createdAt_idx" ON "PublicationView"("publicationId", "createdAt");

-- CreateIndex
CREATE INDEX "PublicationView_utmSource_idx" ON "PublicationView"("utmSource");

-- CreateIndex
CREATE INDEX "PublicationView_createdAt_idx" ON "PublicationView"("createdAt");

-- AddForeignKey
ALTER TABLE "PublicationView" ADD CONSTRAINT "PublicationView_publicationId_fkey" FOREIGN KEY ("publicationId") REFERENCES "Publication"("id") ON DELETE CASCADE ON UPDATE CASCADE;
