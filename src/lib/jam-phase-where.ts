import type { Prisma } from "@/generated/prisma/client";

export type ListedPhase = "UPCOMING" | "ONGOING" | "RATING" | "FINISHED";

// Mirrors jamPhase() in SQL. A published jam without both dates is DRAFT, so it is never
// listed; a ranked jam whose rating end is missing is FINISHED once its end date passes.
export const LISTED_JAM: Prisma.JamWhereInput = {
  deletedAt: null,
  visibility: "PUBLIC",
  publishedAt: { not: null },
  startDate: { not: null },
  endDate: { not: null },
};

export function jamPhaseWhere(phase: ListedPhase, now: Date): Prisma.JamWhereInput {
  switch (phase) {
    case "UPCOMING":
      return { startDate: { gt: now } };
    case "ONGOING":
      return { startDate: { lte: now }, endDate: { gt: now } };
    case "RATING":
      return { ranked: true, endDate: { lte: now }, ratingEnd: { gt: now } };
    case "FINISHED":
      return {
        endDate: { lte: now },
        OR: [{ ranked: false }, { ratingEnd: null }, { ratingEnd: { lte: now } }],
      };
  }
}
