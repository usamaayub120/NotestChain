-- Long markdown notes, and the move to hash-on-chain publications.
--
-- Ordering is load-bearing here. The backfill (step 3) must run before the
-- search trigger is repointed (step 4), or the tsvector rebuild in step 4
-- indexes an empty contentPlain column and every existing publication
-- silently drops out of search.

-- 1. Content format discriminator.
CREATE TYPE "ContentFormat" AS ENUM ('PLAINTEXT', 'MARKDOWN');

-- 2. New columns. Every one defaults in the SAFE direction: existing rows
--    become PLAINTEXT and chainSchemaVersion 1, which is what they actually
--    are. Published notes are immutable and already hashed — reinterpreting
--    an old note containing `*asterisks*` as markdown would change how a
--    permanent record renders.
ALTER TABLE "Publication"
  ADD COLUMN "contentFormat"      "ContentFormat" NOT NULL DEFAULT 'PLAINTEXT',
  ADD COLUMN "contentPlain"       TEXT            NOT NULL DEFAULT '',
  ADD COLUMN "contentBytes"       INTEGER         NOT NULL DEFAULT 0,
  ADD COLUMN "chainSchemaVersion" INTEGER         NOT NULL DEFAULT 1;

ALTER TABLE "Submission"
  ADD COLUMN "contentFormatSnapshot" "ContentFormat" NOT NULL DEFAULT 'PLAINTEXT';

-- Drafts are mutable and unpublished, so the author can see and fix how
-- their text renders. Existing drafts still start as PLAINTEXT (added with
-- that default), and only NEW drafts default to MARKDOWN — hence the
-- separate SET DEFAULT below rather than one ADD COLUMN ... DEFAULT.
ALTER TABLE "Draft"
  ADD COLUMN "contentFormat" "ContentFormat" NOT NULL DEFAULT 'PLAINTEXT';
ALTER TABLE "Draft"
  ALTER COLUMN "contentFormat" SET DEFAULT 'MARKDOWN';

-- 3. Backfill. For a plaintext note the plain projection IS the content.
UPDATE "Publication"
SET "contentPlain" = "content",
    "contentBytes" = octet_length("content");

-- 4. Point the search vector at the plain projection.
--
--    CREATE OR REPLACE FUNCTION alone is NOT enough: the existing trigger
--    fires on UPDATE OF "content", so an update touching only contentPlain
--    would never refire it and the index would drift out of sync without
--    any error. The trigger has to be recreated with the new column list.
CREATE OR REPLACE FUNCTION publication_search_vector_update() RETURNS trigger AS $$
BEGIN
  NEW."searchVector" :=
    setweight(to_tsvector('english', coalesce(NEW."title", '')), 'A') ||
    setweight(to_tsvector('english', coalesce(array_to_string(NEW."tags", ' '), '')), 'B') ||
    setweight(to_tsvector('english', coalesce(NEW."contentPlain", '')), 'C');
  RETURN NEW;
END
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS publication_search_vector_trigger ON "Publication";
CREATE TRIGGER publication_search_vector_trigger
  BEFORE INSERT OR UPDATE OF "title", "contentPlain", "tags" ON "Publication"
  FOR EACH ROW EXECUTE FUNCTION publication_search_vector_update();

-- Rebuild every row's vector through the new function (same no-op update
-- trick the original add_search_vector migration used).
UPDATE "Publication" SET "title" = "title";

-- 5. Content immutability for published rows.
--
--    This is the off-chain stand-in for the guarantee the chain used to
--    provide. With the body no longer stored on-chain, a well-meaning
--    service-layer change that rewrites `content`, `excerpt`, or
--    `contentHash` would silently invalidate verification for every affected
--    note, and it would look like a data problem rather than a code one.
--    `excerpt` is included because from the v2 schema onward it sits inside
--    the hash preimage, so it is as permanent as the body.
--
--    It does not stop a determined operator with direct SQL access. Nothing
--    does. It stops the realistic failure.
CREATE FUNCTION publication_content_immutable() RETURNS trigger AS $$
BEGIN
  IF OLD."status" = 'PUBLISHED' AND (
       NEW."content"     IS DISTINCT FROM OLD."content"     OR
       NEW."title"       IS DISTINCT FROM OLD."title"       OR
       NEW."excerpt"     IS DISTINCT FROM OLD."excerpt"     OR
       NEW."contentHash" IS DISTINCT FROM OLD."contentHash"
     )
  THEN
    RAISE EXCEPTION
      'Published publication content is immutable (id=%). It is covered by an on-chain content hash.',
      OLD."id";
  END IF;
  RETURN NEW;
END
$$ LANGUAGE plpgsql;

CREATE TRIGGER publication_content_immutable_trigger
  BEFORE UPDATE ON "Publication"
  FOR EACH ROW EXECUTE FUNCTION publication_content_immutable();
