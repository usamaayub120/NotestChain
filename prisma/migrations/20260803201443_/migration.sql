-- CreateEnum
CREATE TYPE "Role" AS ENUM ('USER', 'MODERATOR', 'ADMIN');

-- CreateEnum
CREATE TYPE "AccountStatus" AS ENUM ('ACTIVE', 'SUSPENDED', 'DELETED');

-- CreateEnum
CREATE TYPE "IdentityType" AS ENUM ('REAL_NAME', 'PSEUDONYM');

-- CreateEnum
CREATE TYPE "IdentityMode" AS ENUM ('NAMED', 'PSEUDONYMOUS', 'ANONYMOUS');

-- CreateEnum
CREATE TYPE "Discoverability" AS ENUM ('PUBLIC', 'UNLISTED');

-- CreateEnum
CREATE TYPE "DraftStatus" AS ENUM ('DRAFT', 'PENDING_REVIEW', 'CHANGES_REQUESTED', 'REJECTED', 'APPROVED', 'CHAIN_PENDING', 'CHAIN_SUBMITTED', 'PUBLISHED', 'CHAIN_FAILED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "ModerationAction" AS ENUM ('APPROVE', 'REJECT', 'REQUEST_CHANGES');

-- CreateEnum
CREATE TYPE "ChainStatus" AS ENUM ('NOT_SUBMITTED', 'QUEUED', 'SUBMITTING', 'SUBMITTED', 'CONFIRMED', 'FINALIZED', 'FAILED_RETRYABLE', 'FAILED_PERMANENT');

-- CreateEnum
CREATE TYPE "OutboxStatus" AS ENUM ('PENDING', 'PROCESSING', 'PROCESSED', 'FAILED');

-- CreateEnum
CREATE TYPE "ReportStatus" AS ENUM ('OPEN', 'RESOLVED');

-- CreateEnum
CREATE TYPE "ReportResolution" AS ENUM ('DISMISSED', 'DELISTED', 'USER_SUSPENDED');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" "Role" NOT NULL DEFAULT 'USER',
    "status" "AccountStatus" NOT NULL DEFAULT 'ACTIVE',
    "emailVerifiedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "lastLoginAt" TIMESTAMP(3),

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "csrfSecret" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),
    "lastUsedAt" TIMESTAMP(3),
    "userAgent" TEXT,
    "ipAddress" TEXT,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PublicIdentity" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" "IdentityType" NOT NULL,
    "username" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "bio" TEXT NOT NULL DEFAULT '',
    "avatarUrl" TEXT,
    "links" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "isVisible" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PublicIdentity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Draft" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "title" TEXT NOT NULL DEFAULT '',
    "content" TEXT NOT NULL DEFAULT '',
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "identityMode" "IdentityMode" NOT NULL DEFAULT 'NAMED',
    "publicIdentityId" TEXT,
    "discoverability" "Discoverability" NOT NULL DEFAULT 'PUBLIC',
    "status" "DraftStatus" NOT NULL DEFAULT 'DRAFT',
    "lastSavedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "submittedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Draft_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DraftVersion" (
    "id" TEXT NOT NULL,
    "draftId" TEXT NOT NULL,
    "versionNumber" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DraftVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Submission" (
    "id" TEXT NOT NULL,
    "draftId" TEXT NOT NULL,
    "submittedByUserId" TEXT NOT NULL,
    "titleSnapshot" TEXT NOT NULL,
    "contentSnapshot" TEXT NOT NULL,
    "tagsSnapshot" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "identityModeSnapshot" "IdentityMode" NOT NULL,
    "publicIdentityIdSnapshot" TEXT,
    "discoverabilitySnapshot" "Discoverability" NOT NULL,
    "status" "DraftStatus" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "decidedAt" TIMESTAMP(3),

    CONSTRAINT "Submission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ModerationDecision" (
    "id" TEXT NOT NULL,
    "submissionId" TEXT NOT NULL,
    "moderatorUserId" TEXT NOT NULL,
    "action" "ModerationAction" NOT NULL,
    "reason" TEXT NOT NULL,
    "note" TEXT,
    "flaggedPii" BOOLEAN NOT NULL DEFAULT false,
    "flaggedAbuse" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ModerationDecision_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Publication" (
    "id" TEXT NOT NULL,
    "sourceDraftId" TEXT,
    "privateAuthorUserId" TEXT NOT NULL,
    "publicIdentityId" TEXT,
    "identityMode" "IdentityMode" NOT NULL,
    "discoverability" "Discoverability" NOT NULL,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "excerpt" TEXT NOT NULL,
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "contentHash" TEXT NOT NULL,
    "status" "DraftStatus" NOT NULL,
    "isPlatformVisible" BOOLEAN NOT NULL DEFAULT true,
    "delistingReason" TEXT,
    "onChainPublicationId" BIGINT,
    "previousPublicationId" TEXT,
    "publishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Publication_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PublicationChainRecord" (
    "id" TEXT NOT NULL,
    "publicationId" TEXT NOT NULL,
    "network" TEXT NOT NULL,
    "programId" TEXT NOT NULL,
    "publicationPda" TEXT,
    "transactionSignature" TEXT,
    "slot" BIGINT,
    "blockTime" TIMESTAMP(3),
    "chainStatus" "ChainStatus" NOT NULL DEFAULT 'NOT_SUBMITTED',
    "submissionAttempts" INTEGER NOT NULL DEFAULT 0,
    "lastError" TEXT,
    "submittedAt" TIMESTAMP(3),
    "confirmedAt" TIMESTAMP(3),
    "finalizedAt" TIMESTAMP(3),
    "lastVerifiedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PublicationChainRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Tag" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Tag_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PublicationTag" (
    "publicationId" TEXT NOT NULL,
    "tagId" TEXT NOT NULL,

    CONSTRAINT "PublicationTag_pkey" PRIMARY KEY ("publicationId","tagId")
);

-- CreateTable
CREATE TABLE "BookmarkCollection" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BookmarkCollection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Bookmark" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "publicationId" TEXT NOT NULL,
    "collectionId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Bookmark_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Report" (
    "id" TEXT NOT NULL,
    "publicationId" TEXT NOT NULL,
    "reporterUserId" TEXT,
    "reason" TEXT NOT NULL,
    "status" "ReportStatus" NOT NULL DEFAULT 'OPEN',
    "resolution" "ReportResolution",
    "resolutionNote" TEXT,
    "resolvedByUserId" TEXT,
    "resolvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Report_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OutboxEvent" (
    "id" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "aggregateType" TEXT NOT NULL,
    "aggregateId" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "status" "OutboxStatus" NOT NULL DEFAULT 'PENDING',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "availableAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lockedAt" TIMESTAMP(3),
    "lockedBy" TEXT,
    "processedAt" TIMESTAMP(3),
    "lastError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OutboxEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkerJob" (
    "id" TEXT NOT NULL,
    "outboxEventId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "publicationId" TEXT NOT NULL,
    "status" "OutboxStatus" NOT NULL DEFAULT 'PENDING',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "maxAttempts" INTEGER NOT NULL DEFAULT 8,
    "nextAttemptAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WorkerJob_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProcessHeartbeat" (
    "process" TEXT NOT NULL,
    "lastBeatAt" TIMESTAMP(3) NOT NULL,
    "meta" JSONB,

    CONSTRAINT "ProcessHeartbeat_pkey" PRIMARY KEY ("process")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "actorUserId" TEXT,
    "action" TEXT NOT NULL,
    "targetType" TEXT,
    "targetId" TEXT,
    "metadata" JSONB,
    "ipAddress" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "User_status_idx" ON "User"("status");

-- CreateIndex
CREATE UNIQUE INDEX "Session_tokenHash_key" ON "Session"("tokenHash");

-- CreateIndex
CREATE INDEX "Session_userId_idx" ON "Session"("userId");

-- CreateIndex
CREATE INDEX "Session_expiresAt_idx" ON "Session"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "PublicIdentity_username_key" ON "PublicIdentity"("username");

-- CreateIndex
CREATE INDEX "PublicIdentity_userId_idx" ON "PublicIdentity"("userId");

-- CreateIndex
CREATE INDEX "Draft_userId_status_idx" ON "Draft"("userId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "DraftVersion_draftId_versionNumber_key" ON "DraftVersion"("draftId", "versionNumber");

-- CreateIndex
CREATE INDEX "Submission_status_createdAt_idx" ON "Submission"("status", "createdAt");

-- CreateIndex
CREATE INDEX "Submission_draftId_idx" ON "Submission"("draftId");

-- CreateIndex
CREATE INDEX "ModerationDecision_submissionId_idx" ON "ModerationDecision"("submissionId");

-- CreateIndex
CREATE UNIQUE INDEX "Publication_sourceDraftId_key" ON "Publication"("sourceDraftId");

-- CreateIndex
CREATE UNIQUE INDEX "Publication_onChainPublicationId_key" ON "Publication"("onChainPublicationId");

-- CreateIndex
CREATE INDEX "Publication_discoverability_isPlatformVisible_status_idx" ON "Publication"("discoverability", "isPlatformVisible", "status");

-- CreateIndex
CREATE INDEX "Publication_publicIdentityId_idx" ON "Publication"("publicIdentityId");

-- CreateIndex
CREATE INDEX "Publication_privateAuthorUserId_idx" ON "Publication"("privateAuthorUserId");

-- CreateIndex
CREATE INDEX "Publication_createdAt_idx" ON "Publication"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "PublicationChainRecord_publicationId_key" ON "PublicationChainRecord"("publicationId");

-- CreateIndex
CREATE INDEX "PublicationChainRecord_chainStatus_idx" ON "PublicationChainRecord"("chainStatus");

-- CreateIndex
CREATE INDEX "PublicationChainRecord_transactionSignature_idx" ON "PublicationChainRecord"("transactionSignature");

-- CreateIndex
CREATE UNIQUE INDEX "Tag_slug_key" ON "Tag"("slug");

-- CreateIndex
CREATE INDEX "PublicationTag_tagId_idx" ON "PublicationTag"("tagId");

-- CreateIndex
CREATE UNIQUE INDEX "BookmarkCollection_userId_name_key" ON "BookmarkCollection"("userId", "name");

-- CreateIndex
CREATE INDEX "Bookmark_collectionId_idx" ON "Bookmark"("collectionId");

-- CreateIndex
CREATE UNIQUE INDEX "Bookmark_userId_publicationId_key" ON "Bookmark"("userId", "publicationId");

-- CreateIndex
CREATE INDEX "Report_status_idx" ON "Report"("status");

-- CreateIndex
CREATE INDEX "Report_publicationId_idx" ON "Report"("publicationId");

-- CreateIndex
CREATE INDEX "OutboxEvent_status_availableAt_idx" ON "OutboxEvent"("status", "availableAt");

-- CreateIndex
CREATE UNIQUE INDEX "OutboxEvent_aggregateType_aggregateId_eventType_key" ON "OutboxEvent"("aggregateType", "aggregateId", "eventType");

-- CreateIndex
CREATE UNIQUE INDEX "WorkerJob_outboxEventId_key" ON "WorkerJob"("outboxEventId");

-- CreateIndex
CREATE INDEX "WorkerJob_status_nextAttemptAt_idx" ON "WorkerJob"("status", "nextAttemptAt");

-- CreateIndex
CREATE INDEX "WorkerJob_publicationId_idx" ON "WorkerJob"("publicationId");

-- CreateIndex
CREATE INDEX "AuditLog_action_createdAt_idx" ON "AuditLog"("action", "createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_targetType_targetId_idx" ON "AuditLog"("targetType", "targetId");

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PublicIdentity" ADD CONSTRAINT "PublicIdentity_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Draft" ADD CONSTRAINT "Draft_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Draft" ADD CONSTRAINT "Draft_publicIdentityId_fkey" FOREIGN KEY ("publicIdentityId") REFERENCES "PublicIdentity"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DraftVersion" ADD CONSTRAINT "DraftVersion_draftId_fkey" FOREIGN KEY ("draftId") REFERENCES "Draft"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Submission" ADD CONSTRAINT "Submission_draftId_fkey" FOREIGN KEY ("draftId") REFERENCES "Draft"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Submission" ADD CONSTRAINT "Submission_submittedByUserId_fkey" FOREIGN KEY ("submittedByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ModerationDecision" ADD CONSTRAINT "ModerationDecision_submissionId_fkey" FOREIGN KEY ("submissionId") REFERENCES "Submission"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ModerationDecision" ADD CONSTRAINT "ModerationDecision_moderatorUserId_fkey" FOREIGN KEY ("moderatorUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Publication" ADD CONSTRAINT "Publication_sourceDraftId_fkey" FOREIGN KEY ("sourceDraftId") REFERENCES "Draft"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Publication" ADD CONSTRAINT "Publication_privateAuthorUserId_fkey" FOREIGN KEY ("privateAuthorUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Publication" ADD CONSTRAINT "Publication_publicIdentityId_fkey" FOREIGN KEY ("publicIdentityId") REFERENCES "PublicIdentity"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Publication" ADD CONSTRAINT "Publication_previousPublicationId_fkey" FOREIGN KEY ("previousPublicationId") REFERENCES "Publication"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PublicationChainRecord" ADD CONSTRAINT "PublicationChainRecord_publicationId_fkey" FOREIGN KEY ("publicationId") REFERENCES "Publication"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PublicationTag" ADD CONSTRAINT "PublicationTag_publicationId_fkey" FOREIGN KEY ("publicationId") REFERENCES "Publication"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PublicationTag" ADD CONSTRAINT "PublicationTag_tagId_fkey" FOREIGN KEY ("tagId") REFERENCES "Tag"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BookmarkCollection" ADD CONSTRAINT "BookmarkCollection_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Bookmark" ADD CONSTRAINT "Bookmark_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Bookmark" ADD CONSTRAINT "Bookmark_publicationId_fkey" FOREIGN KEY ("publicationId") REFERENCES "Publication"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Bookmark" ADD CONSTRAINT "Bookmark_collectionId_fkey" FOREIGN KEY ("collectionId") REFERENCES "BookmarkCollection"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Report" ADD CONSTRAINT "Report_publicationId_fkey" FOREIGN KEY ("publicationId") REFERENCES "Publication"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Report" ADD CONSTRAINT "Report_reporterUserId_fkey" FOREIGN KEY ("reporterUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Report" ADD CONSTRAINT "Report_resolvedByUserId_fkey" FOREIGN KEY ("resolvedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkerJob" ADD CONSTRAINT "WorkerJob_outboxEventId_fkey" FOREIGN KEY ("outboxEventId") REFERENCES "OutboxEvent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
