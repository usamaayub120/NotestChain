-- Keeper profiles, expanded byline fields, and the follow graph.
--
-- Purely additive. Every new column is nullable or defaulted, so the API and
-- the already-installed mobile binary keep working against this schema
-- unchanged. Backfilling one primary identity per user is a separate step
-- (scripts/backfill-keeper-profiles.ts) because generating a unique username
-- needs real logic, not SQL.

ALTER TABLE "PublicIdentity"
  ADD COLUMN "isPrimary" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "location" TEXT,
  ADD COLUMN "pronouns" TEXT,
  ADD COLUMN "birthDate" TIMESTAMP(3),
  ADD COLUMN "showBirthDate" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "gender" TEXT,
  ADD COLUMN "showGender" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "usernameChangedAt" TIMESTAMP(3);

-- At most one Keeper profile per user. Prisma's @@unique cannot carry a WHERE
-- clause, and @@unique([userId, isPrimary]) would wrongly forbid a second pen
-- name as well, so this index is maintained by hand.
CREATE UNIQUE INDEX "PublicIdentity_userId_primary_key"
  ON "PublicIdentity" ("userId")
  WHERE "isPrimary" = true;

CREATE TABLE "Follow" (
  "id"               TEXT NOT NULL,
  "followerUserId"   TEXT NOT NULL,
  "targetIdentityId" TEXT NOT NULL,
  "createdAt"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "Follow_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Follow_followerUserId_targetIdentityId_key"
  ON "Follow" ("followerUserId", "targetIdentityId");
CREATE INDEX "Follow_targetIdentityId_idx" ON "Follow" ("targetIdentityId");
CREATE INDEX "Follow_followerUserId_idx" ON "Follow" ("followerUserId");

ALTER TABLE "Follow"
  ADD CONSTRAINT "Follow_followerUserId_fkey"
    FOREIGN KEY ("followerUserId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "Follow_targetIdentityId_fkey"
    FOREIGN KEY ("targetIdentityId") REFERENCES "PublicIdentity" ("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Comments gain a byline. Nullable on purpose: existing comments predate
-- bylines and keep rendering from authorDisplayNameSnapshot, with legacy
-- isAnonymous rows still showing as "Anonymous". Nothing is backfilled — a
-- comment posted anonymously stays anonymous.
ALTER TABLE "Comment"
  ADD COLUMN "publicIdentityId" TEXT;

CREATE INDEX "Comment_publicIdentityId_idx" ON "Comment" ("publicIdentityId");

-- RESTRICT, not SET NULL: a comment is public content, and dropping its byline
-- would silently strip attribution. deleteIdentity() soft-hides any byline that
-- has comments or publications instead of removing it, the same rule that
-- already protects published notes.
ALTER TABLE "Comment"
  ADD CONSTRAINT "Comment_publicIdentityId_fkey"
    FOREIGN KEY ("publicIdentityId") REFERENCES "PublicIdentity" ("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Covers the Following feed: publications for a set of bylines, newest first.
CREATE INDEX "Publication_publicIdentityId_createdAt_idx"
  ON "Publication" ("publicIdentityId", "createdAt");
