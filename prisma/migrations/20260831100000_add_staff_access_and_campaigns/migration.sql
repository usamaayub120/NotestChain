-- Additive staff roles keep the existing Role column intact for a safe,
-- reversible authorization rollout. Existing role values are copied below.
CREATE TYPE "StaffRole" AS ENUM ('MODERATOR', 'CAMPAIGN_CREATOR', 'CAMPAIGN_APPROVER', 'PLATFORM_ADMIN', 'ACCESS_MANAGER', 'OWNER');
CREATE TYPE "StaffInvitationStatus" AS ENUM ('PENDING', 'ACCEPTED', 'REVOKED', 'EXPIRED');

CREATE TABLE "StaffRoleAssignment" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "role" "StaffRole" NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "StaffRoleAssignment_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "StaffRoleAssignment_userId_role_key" ON "StaffRoleAssignment"("userId", "role");
CREATE INDEX "StaffRoleAssignment_role_idx" ON "StaffRoleAssignment"("role");
ALTER TABLE "StaffRoleAssignment" ADD CONSTRAINT "StaffRoleAssignment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

INSERT INTO "StaffRoleAssignment" ("id", "userId", "role")
SELECT gen_random_uuid()::text, "id", CASE "role" WHEN 'MODERATOR' THEN 'MODERATOR'::"StaffRole" ELSE 'PLATFORM_ADMIN'::"StaffRole" END
FROM "User" WHERE "role" IN ('MODERATOR', 'ADMIN');

CREATE TABLE "StaffInvitation" (
  "id" TEXT NOT NULL,
  "email" TEXT NOT NULL,
  "tokenHash" TEXT NOT NULL,
  "roles" "StaffRole"[] NOT NULL,
  "status" "StaffInvitationStatus" NOT NULL DEFAULT 'PENDING',
  "invitedById" TEXT NOT NULL,
  "acceptedById" TEXT,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "acceptedAt" TIMESTAMP(3),
  "revokedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "StaffInvitation_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "StaffInvitation_tokenHash_key" ON "StaffInvitation"("tokenHash");
CREATE INDEX "StaffInvitation_email_status_idx" ON "StaffInvitation"("email", "status");
CREATE INDEX "StaffInvitation_expiresAt_idx" ON "StaffInvitation"("expiresAt");
ALTER TABLE "StaffInvitation" ADD CONSTRAINT "StaffInvitation_invitedById_fkey" FOREIGN KEY ("invitedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TYPE "EmailKind" ADD VALUE IF NOT EXISTS 'STAFF_INVITATION';
CREATE TYPE "CampaignObjective" AS ENUM ('ONBOARDING', 'REENGAGEMENT', 'ANNOUNCEMENT');
CREATE TYPE "CampaignStatus" AS ENUM ('DRAFT', 'PENDING_APPROVAL', 'APPROVED', 'SCHEDULED', 'RUNNING', 'COMPLETED', 'PAUSED', 'CANCELLED', 'FAILED');
CREATE TYPE "CampaignRecipientStatus" AS ENUM ('PENDING', 'SENDING', 'ACCEPTED', 'SUPPRESSED', 'FAILED', 'UNKNOWN');
CREATE TYPE "CampaignEndpointKind" AS ENUM ('LEGACY_PUSH_TOKEN', 'PUSH_INSTALLATION');

CREATE TABLE "Campaign" (
  "id" TEXT NOT NULL, "name" TEXT NOT NULL, "objective" "CampaignObjective" NOT NULL,
  "status" "CampaignStatus" NOT NULL DEFAULT 'DRAFT', "activeVersionId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Campaign_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "Campaign_activeVersionId_key" ON "Campaign"("activeVersionId");
CREATE INDEX "Campaign_status_idx" ON "Campaign"("status");

CREATE TABLE "CampaignVersion" (
  "id" TEXT NOT NULL, "campaignId" TEXT NOT NULL, "version" INTEGER NOT NULL, "title" TEXT NOT NULL, "body" TEXT NOT NULL, "deepLink" TEXT NOT NULL,
  "audience" JSONB NOT NULL, "schedule" JSONB NOT NULL, "createdById" TEXT NOT NULL, "approvedById" TEXT,
  "approvedAt" TIMESTAMP(3), "frozenAt" TIMESTAMP(3), "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "CampaignVersion_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "CampaignVersion_campaignId_version_key" ON "CampaignVersion"("campaignId", "version");
ALTER TABLE "CampaignVersion" ADD CONSTRAINT "CampaignVersion_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CampaignVersion" ADD CONSTRAINT "CampaignVersion_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CampaignVersion" ADD CONSTRAINT "CampaignVersion_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Campaign" ADD CONSTRAINT "Campaign_activeVersionId_fkey" FOREIGN KEY ("activeVersionId") REFERENCES "CampaignVersion"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "CampaignRun" (
  "id" TEXT NOT NULL, "campaignId" TEXT NOT NULL, "versionId" TEXT NOT NULL, "scheduledAt" TIMESTAMP(3) NOT NULL, "startedAt" TIMESTAMP(3), "completedAt" TIMESTAMP(3), "acceptedCount" INTEGER NOT NULL DEFAULT 0, "openCount" INTEGER NOT NULL DEFAULT 0, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CampaignRun_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "CampaignRun_scheduledAt_idx" ON "CampaignRun"("scheduledAt");
ALTER TABLE "CampaignRun" ADD CONSTRAINT "CampaignRun_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CampaignRun" ADD CONSTRAINT "CampaignRun_versionId_fkey" FOREIGN KEY ("versionId") REFERENCES "CampaignVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "CampaignRecipient" (
  "id" TEXT NOT NULL, "runId" TEXT NOT NULL, "endpointId" TEXT NOT NULL, "endpointKind" "CampaignEndpointKind" NOT NULL DEFAULT 'LEGACY_PUSH_TOKEN', "deliveryToken" TEXT NOT NULL, "status" "CampaignRecipientStatus" NOT NULL DEFAULT 'PENDING', "suppressedReason" TEXT, "acceptedAt" TIMESTAMP(3), "openedAt" TIMESTAMP(3), "lastError" TEXT, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "CampaignRecipient_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "CampaignRecipient_deliveryToken_key" ON "CampaignRecipient"("deliveryToken");
CREATE UNIQUE INDEX "CampaignRecipient_runId_endpointId_key" ON "CampaignRecipient"("runId", "endpointId");
CREATE INDEX "CampaignRecipient_status_idx" ON "CampaignRecipient"("status");
ALTER TABLE "CampaignRecipient" ADD CONSTRAINT "CampaignRecipient_runId_fkey" FOREIGN KEY ("runId") REFERENCES "CampaignRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "PushInstallation" (
  "id" TEXT NOT NULL, "credentialHash" TEXT NOT NULL, "userId" TEXT, "tokenCiphertext" TEXT NOT NULL, "tokenLookupHash" TEXT NOT NULL, "keyVersion" INTEGER NOT NULL DEFAULT 1,
  "platform" "PushPlatform" NOT NULL, "productOptIn" BOOLEAN NOT NULL DEFAULT false, "activityAlertsOptIn" BOOLEAN NOT NULL DEFAULT false, "permissionGranted" BOOLEAN NOT NULL DEFAULT false,
  "timeZone" TEXT, "appVersion" TEXT, "firstSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "lastForegroundAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "productOptInAt" TIMESTAMP(3), "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "PushInstallation_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "PushInstallation_credentialHash_key" ON "PushInstallation"("credentialHash");
CREATE UNIQUE INDEX "PushInstallation_tokenLookupHash_key" ON "PushInstallation"("tokenLookupHash");
CREATE INDEX "PushInstallation_userId_idx" ON "PushInstallation"("userId");
CREATE INDEX "PushInstallation_productOptIn_lastSeenAt_idx" ON "PushInstallation"("productOptIn", "lastSeenAt");
ALTER TABLE "PushInstallation" ADD CONSTRAINT "PushInstallation_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
