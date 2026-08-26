-- Push notifications: device tokens and a durable send queue, mirroring
-- EmailJob's shape exactly (see that model's doc comment in schema.prisma
-- for why this is a parallel table rather than a generalized one). Purely
-- additive — the worker only starts creating PushJob rows once the API
-- code that enqueues them ships, so this migration alone changes nothing
-- observable.

CREATE TYPE "PushPlatform" AS ENUM ('IOS', 'ANDROID');
CREATE TYPE "PushKind" AS ENUM (
  'COMMENT_RECEIVED',
  'PUBLICATION_APPROVED',
  'PUBLICATION_REJECTED',
  'PUBLICATION_CHANGES_REQUESTED',
  'PUBLICATION_CHAIN_FINALIZED',
  'NEW_FOLLOWER'
);
CREATE TYPE "PushJobStatus" AS ENUM ('PENDING', 'PROCESSING', 'SENT', 'FAILED');

CREATE TABLE "PushToken" (
  "id"        TEXT NOT NULL,
  "userId"    TEXT NOT NULL,
  "token"     TEXT NOT NULL,
  "platform"  "PushPlatform" NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "PushToken_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PushToken_token_key" ON "PushToken" ("token");
CREATE INDEX "PushToken_userId_idx" ON "PushToken" ("userId");

ALTER TABLE "PushToken"
  ADD CONSTRAINT "PushToken_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "PushJob" (
  "id"            TEXT NOT NULL,
  "kind"          "PushKind" NOT NULL,
  "userId"        TEXT NOT NULL,
  "data"          JSONB NOT NULL,
  "status"        "PushJobStatus" NOT NULL DEFAULT 'PENDING',
  "attempts"      INTEGER NOT NULL DEFAULT 0,
  "maxAttempts"   INTEGER NOT NULL DEFAULT 5,
  "nextAttemptAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "lastError"     TEXT,
  "sentAt"        TIMESTAMP(3),
  "createdAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"     TIMESTAMP(3) NOT NULL,

  CONSTRAINT "PushJob_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "PushJob_status_nextAttemptAt_idx" ON "PushJob" ("status", "nextAttemptAt");
CREATE INDEX "PushJob_userId_idx" ON "PushJob" ("userId");

ALTER TABLE "PushJob"
  ADD CONSTRAINT "PushJob_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE;
