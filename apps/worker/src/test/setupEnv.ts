// Runs before any test file's imports, so config/env.ts's module-level
// loadEnv() sees these values — never point tests at the real dev/prod DB.
// Mirrors apps/api/src/test/setupEnv.ts; the two are independent because
// the API and worker each own their own env schema (see
// apps/worker/src/config/env.ts's doc comment on why SMTP is enforced
// differently between the two).
process.env.NODE_ENV = "test";
process.env.DATABASE_URL ??= "postgresql://postgres:password@localhost:5432/noteschain_test";
process.env.LOG_LEVEL = "fatal";
