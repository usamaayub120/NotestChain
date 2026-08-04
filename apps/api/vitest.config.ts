import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    setupFiles: ["./src/test/setupEnv.ts"],
    fileParallelism: false, // all test files share one Postgres test DB
  },
});
