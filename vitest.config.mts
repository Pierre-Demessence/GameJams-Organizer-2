import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
    coverage: {
      provider: "v8",
      reporter: ["text", "html", "lcov"],
      reportsDirectory: "coverage/unit",
      // Unit-suite health: scope to the pure logic unit tests can/should own.
      // Server actions, pages and UI components belong to the overall report
      // (vitest.overall.config.mts), not here.
      include: ["src/lib/**/*.ts", "src/components/markdown.tsx"],
      exclude: [
        "src/**/*.test.ts",
        "src/lib/auth.ts",
        "src/lib/auth.config.ts",
        "src/lib/db.ts",
        "src/lib/rate-limit.ts",
        "src/lib/audit.ts",
      ],
    },
  },
});
