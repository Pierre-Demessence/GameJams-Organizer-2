// Single source of truth for the integration test database URL. Defaults to a
// dedicated `gamejams_test` DB on the docker-compose Postgres so tests never
// touch dev data.
export const TEST_DATABASE_URL =
  process.env.TEST_DATABASE_URL ??
  "postgresql://gamejams:gamejams@localhost:5432/gamejams_test";
