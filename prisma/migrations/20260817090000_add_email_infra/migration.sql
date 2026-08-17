-- Transactional email infrastructure: a durable, retryable EmailJob queue,
-- deliberately separate from OutboxEvent/WorkerJob (see the model's doc
-- comment in schema.prisma for why — those tables are hard-coupled to the
-- blockchain-publish pipeline and this doesn't touch them at all).

CREATE TYPE "EmailKind" AS ENUM (
  'PUBLICATION_APPROVED',
  'PUBLICATION_REJECTED',
  'PUBLICATION_CHANGES_REQUESTED',
  'PUBLICATION_CHAIN_FINALIZED',
  'PASSWORD_RESET_REQUESTED',
  'ACCOUNT_WELCOME',
  'COMMENT_RECEIVED'
);

CREATE TYPE "EmailJobStatus" AS ENUM ('PENDING', 'PROCESSING', 'SENT', 'FAILED');

CREATE TABLE "EmailJob" (
    "id" TEXT NOT NULL,
    "kind" "EmailKind" NOT NULL,
    "toEmail" TEXT NOT NULL,
    "toUserId" TEXT,
    "data" JSONB NOT NULL,
    "status" "EmailJobStatus" NOT NULL DEFAULT 'PENDING',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "maxAttempts" INTEGER NOT NULL DEFAULT 5,
    "nextAttemptAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastError" TEXT,
    "sentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EmailJob_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "EmailJob_status_nextAttemptAt_idx" ON "EmailJob"("status", "nextAttemptAt");

CREATE INDEX "EmailJob_toUserId_idx" ON "EmailJob"("toUserId");

ALTER TABLE "EmailJob" ADD CONSTRAINT "EmailJob_toUserId_fkey" FOREIGN KEY ("toUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
