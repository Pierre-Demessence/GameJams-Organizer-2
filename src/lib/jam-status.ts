import type { JamStatus } from "@/generated/prisma/client";

interface JamDates {
  startDate: Date | null;
  endDate: Date | null;
  ratingEnd: Date | null;
  ranked: boolean;
}

export function computeJamStatus(jam: JamDates, now = new Date()): JamStatus {
  if (!jam.startDate || !jam.endDate) return "DRAFT";
  if (now < jam.startDate) return "UPCOMING";
  if (now < jam.endDate) return "ONGOING";
  if (jam.ranked && jam.ratingEnd) {
    if (now < jam.ratingEnd) return "RATING";
  }
  return "FINISHED";
}
