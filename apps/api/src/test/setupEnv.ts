// Runs before any test file's imports, so config/env.ts's module-level
// loadEnv() sees these values — never point tests at the real dev/prod DB.
process.env.NODE_ENV = "test";
process.env.DATABASE_URL ??= "postgresql://postgres:password@localhost:5432/noteschain_test";
process.env.SESSION_SECRET ??= "test-only-session-secret-not-used-anywhere-else-00000000";
process.env.COOKIE_SECURE = "false";
process.env.LOG_LEVEL = "fatal";
