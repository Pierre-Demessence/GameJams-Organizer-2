import { execSync } from "node:child_process";
import { Client } from "pg";
import { TEST_DATABASE_URL } from "./test-db-url";

// Runs once before the integration suite: ensure the test database exists, then
// apply migrations to it. Runs in a separate context from the test workers, so
// env set here does not leak into tests (setup.ts sets DATABASE_URL there).
export default async function globalSetup(): Promise<void> {
  const dbName = new URL(TEST_DATABASE_URL).pathname.replace(/^\//, "");
  const adminUrl = new URL(TEST_DATABASE_URL);
  adminUrl.pathname = "/postgres";

  const client = new Client({ connectionString: adminUrl.toString() });
  await client.connect();
  try {
    const existing = await client.query(
      "SELECT 1 FROM pg_database WHERE datname = $1",
      [dbName]
    );
    if (existing.rowCount === 0) {
      // Identifier can't be parameterized; dbName comes from our own config.
      await client.query(`CREATE DATABASE "${dbName}"`);
    }
  } finally {
    await client.end();
  }

  execSync("pnpm exec prisma migrate deploy", {
    stdio: "inherit",
    env: { ...process.env, DATABASE_URL: TEST_DATABASE_URL },
  });
}
