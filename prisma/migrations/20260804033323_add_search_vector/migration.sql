-- Plain (non-generated) tsvector column, kept in sync by a trigger rather
-- than `GENERATED ALWAYS AS ... STORED` — Postgres rejects to_tsvector()
-- in a generated-column expression as "not immutable" (a long-standing,
-- widely-documented quirk around text search configs), so a
-- BEFORE INSERT/UPDATE trigger is the standard, reliable alternative.
-- Weighted: title (A) > tags (B) > body (C). Author/username search is
-- handled separately in the search service via a join to PublicIdentity.
ALTER TABLE "Publication" ADD COLUMN "searchVector" tsvector;

CREATE FUNCTION publication_search_vector_update() RETURNS trigger AS $$
BEGIN
  NEW."searchVector" :=
    setweight(to_tsvector('english', coalesce(NEW."title", '')), 'A') ||
    setweight(to_tsvector('english', coalesce(array_to_string(NEW."tags", ' '), '')), 'B') ||
    setweight(to_tsvector('english', coalesce(NEW."content", '')), 'C');
  RETURN NEW;
END
$$ LANGUAGE plpgsql;

CREATE TRIGGER publication_search_vector_trigger
  BEFORE INSERT OR UPDATE OF "title", "content", "tags" ON "Publication"
  FOR EACH ROW EXECUTE FUNCTION publication_search_vector_update();

-- Backfill any rows inserted before this migration.
UPDATE "Publication" SET "title" = "title";

-- CreateIndex
CREATE INDEX "Publication_searchVector_idx" ON "Publication" USING GIN ("searchVector");
