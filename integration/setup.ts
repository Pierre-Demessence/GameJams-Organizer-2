import { beforeEach, vi } from "vitest";
import { db } from "@/lib/db";

vi.mock("@/lib/auth", async () => {
  const { currentSession } = await import("./current-session");
  return { auth: async () => currentSession.value };
});

vi.mock("next/cache", () => ({
  revalidatePath: () => {},
  revalidateTag: () => {},
}));

vi.mock("next/navigation", () => ({
  redirect: () => {
    throw new Error("NEXT_REDIRECT");
  },
}));

async function truncateAll(): Promise<void> {
  const rows = await db.$queryRaw<{ tablename: string }[]>`
    SELECT tablename FROM pg_tables
    WHERE schemaname = 'public' AND tablename <> '_prisma_migrations'
  `;
  if (rows.length === 0) return;
  // Table names come from the system catalog (never user input), so interpolating
  // them into the TRUNCATE is safe; $executeRawUnsafe is required for DDL.
  const list = rows.map((r) => `"public"."${r.tablename}"`).join(", ");
  await db.$executeRawUnsafe(`TRUNCATE TABLE ${list} RESTART IDENTITY CASCADE`);
}

beforeEach(async () => {
  const { signOut } = await import("./current-session");
  signOut();
  await truncateAll();
});
