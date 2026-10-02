CREATE TABLE "PublicationTranslation" (
  "id" TEXT NOT NULL,
  "publicationId" TEXT NOT NULL,
  "targetLang" TEXT NOT NULL,
  "sourceDigest" TEXT NOT NULL,
  "translatedTitle" TEXT NOT NULL,
  "translatedText" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PublicationTranslation_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "PublicationTranslation_publicationId_fkey" FOREIGN KEY ("publicationId") REFERENCES "Publication"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "PublicationTranslation_publicationId_targetLang_sourceDigest_key"
  ON "PublicationTranslation"("publicationId", "targetLang", "sourceDigest");
