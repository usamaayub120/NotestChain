-- Store the mobile release policy in the existing singleton settings row so
-- authorised admins can change it without an image rebuild or VPS restart.
ALTER TABLE "SiteSettings"
ADD COLUMN "androidLatestBuild" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN "androidMinimumBuild" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN "androidLatestVersion" TEXT NOT NULL DEFAULT '1.0.0';
