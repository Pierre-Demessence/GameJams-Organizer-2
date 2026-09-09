import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

// Honest whole-app coverage across BOTH the unit suite and the server-action
// integration suite, merged into one report. Only genuinely-untestable
// framework/config glue and generated code is excluded, so untested areas show
// their real numbers. Requires a running Postgres (the integration project spins
// up the gamejams_test DB). e2e (Playwright) runs separately and isn't included.

const alias = { "@": fileURLToPath(new URL("./src", import.meta.url)) };

const TEST_DATABASE_URL =
  process.env.TEST_DATABASE_URL ??
  "postgresql://gamejams:gamejams@localhost:5432/gamejams_test";

export default defineConfig({
  test: {
    coverage: {
      provider: "v8",
      reporter: ["text", "html"],
      reportsDirectory: "coverage/overall",
      include: ["src/**/*.{ts,tsx}"],
      exclude: [
        "src/**/*.test.ts",
        "src/**/*.d.ts",
        "src/generated/**",
        "src/types/**",
        "src/lib/auth.ts",
        "src/lib/auth.config.ts",
        "src/lib/db.ts",
        "src/middleware.ts",
        "src/app/**/{layout,loading,error,not-found}.tsx",
      ],
    },
    projects: [
      {
        resolve: { alias },
        test: {
          name: "unit",
          environment: "node",
          include: ["src/**/*.test.ts"],
        },
      },
      {
        resolve: { alias },
        test: {
          name: "integration",
          environment: "node",
          include: ["tests/integration/**/*.test.ts"],
          globalSetup: ["./tests/integration/global-setup.ts"],
          setupFiles: ["./tests/integration/setup.ts"],
          fileParallelism: false,
          testTimeout: 20_000,
          env: { DATABASE_URL: TEST_DATABASE_URL },
        },
      },
    ],
  },
});
