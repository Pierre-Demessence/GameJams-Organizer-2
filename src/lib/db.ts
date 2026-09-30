import { PrismaClient } from "@/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const SOFT_DELETE_MODELS = new Set(["Jam", "Submission"]);
const READ_OPERATIONS = new Set([
  "findUnique",
  "findUniqueOrThrow",
  "findFirst",
  "findFirstOrThrow",
  "findMany",
  "count",
  "aggregate",
  "groupBy",
]);

// Top-level reads of soft-deletable models only see live rows. A query that
// names `deletedAt` itself (e.g. the staff trash view) opts out. Prisma query
// extensions do not reach relation filters, includes or `_count`, so those must
// still filter `deletedAt` explicitly.
function createClient() {
  const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
  return new PrismaClient({ adapter }).$extends({
    name: "soft-delete",
    query: {
      $allModels: {
        async $allOperations({ model, operation, args, query }) {
          if (SOFT_DELETE_MODELS.has(model) && READ_OPERATIONS.has(operation)) {
            // $allOperations types args as a union over every operation; all the
            // read operations above accept an optional `where` object.
            const readArgs = (args ?? {}) as { where?: Record<string, unknown> };
            if (!readArgs.where || !("deletedAt" in readArgs.where)) {
              return query({ ...readArgs, where: { ...readArgs.where, deletedAt: null } });
            }
          }
          return query(args);
        },
      },
    },
  });
}

type Db = ReturnType<typeof createClient>;

const globalForPrisma = globalThis as unknown as { prisma?: Db };

export const db = globalForPrisma.prisma ?? createClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = db;
