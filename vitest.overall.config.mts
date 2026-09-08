import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

// Honest whole-app coverage: measures how much of src is exercised by the JS
// test runner (unit + future integration tests). Only genuinely-untestable
// framework/config glue and generated code is excluded, so untested areas
// (server actions, components) show their real numbers and climb over time.
// e2e (Playwright) runs in a separate process and is not reflected here.
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
  },
});
