import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

const TEST_DATABASE_URL =
  process.env.TEST_DATABASE_URL ??
  "postgresql://gamejams:gamejams@localhost:5432/gamejams_test";

// Integration tests: call server actions directly against a real Postgres test
// DB. Kept separate from the fast unit suite (pnpm test) and run via
// pnpm test:integration.
export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  test: {
    environment: "node",
    include: ["integration/**/*.test.ts"],
    globalSetup: ["./integration/global-setup.ts"],
    setupFiles: ["./integration/setup.ts"],
    // Tests share one database and truncate between tests, so files must not run
    // concurrently against it.
    fileParallelism: false,
    testTimeout: 20_000,
    env: { DATABASE_URL: TEST_DATABASE_URL },
  },
});
