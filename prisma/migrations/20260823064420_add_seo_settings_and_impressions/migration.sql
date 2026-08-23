-- AlterTable
ALTER TABLE "Publication" ADD COLUMN     "impressionCount" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "SiteSettings" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "ga4MeasurementId" TEXT,
    "searchConsoleVerification" TEXT,
    "defaultMetaDescription" TEXT,
    "defaultOgImageUrl" TEXT,
    "twitterHandle" TEXT,
    "indexingEnabled" BOOLEAN NOT NULL DEFAULT true,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SiteSettings_pkey" PRIMARY KEY ("id")
);
