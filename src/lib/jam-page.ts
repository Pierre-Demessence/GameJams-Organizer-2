import type { JamPhase, JamPhaseInput } from "@/domain/jam-phase";
import { canJoin } from "@/domain/participation";
import { canCreateSubmission } from "@/domain/submission";
import { phaseProgress } from "@/lib/jam-status-display";

export type TimelineState = "past" | "current" | "future";
export interface TimelineSegment {
  key: "upcoming" | "jam" | "rating";
  label: string;
  dates: string;
  widthPct: number;
  state: TimelineState;
  progress: number;
}

export type EntryPanel =
  | { kind: "signed-out"; canJoin: boolean }
  | { kind: "can-join" }
  | { kind: "joined"; canCreate: boolean }
  | { kind: "has-entry"; submissionId: string; status: "DRAFT" | "SUBMITTED" }
  | { kind: "closed" };

const DAY = new Intl.DateTimeFormat("en", { month: "short", day: "2-digit", timeZone: "UTC" });

export function dayRange(from: Date | null, to: Date | null): string {
  if (!from || !to) return "";
  return `${DAY.format(from)} → ${DAY.format(to)}`;
}

const ORDER: Record<JamPhase, number> = { DRAFT: -1, UPCOMING: 0, ONGOING: 1, RATING: 2, FINISHED: 3 };

function upcomingProgress(jam: JamPhaseInput, now: Date): number {
  if (!jam.publishedAt || !jam.startDate) return 0;
  const span = jam.startDate.getTime() - jam.publishedAt.getTime();
  if (span <= 0) return 100;
  const pct = ((now.getTime() - jam.publishedAt.getTime()) / span) * 100;
  return Math.min(100, Math.max(0, Math.round(pct)));
}

// Segment widths are fixed shares, not proportional to durations: an upcoming window can be
// months long, which would squash the jam itself to a sliver.
export function jamTimeline(jam: JamPhaseInput, phase: JamPhase, now = new Date()): TimelineSegment[] {
  const defs = jam.ranked
    ? [
        { key: "upcoming", label: "Upcoming", index: 0, width: 18, dates: dayRange(jam.publishedAt, jam.startDate) },
        { key: "jam", label: "Jam", index: 1, width: 37, dates: dayRange(jam.startDate, jam.endDate) },
        { key: "rating", label: "Rating", index: 2, width: 45, dates: dayRange(jam.endDate, jam.ratingEnd) },
      ] as const
    : [
        { key: "upcoming", label: "Upcoming", index: 0, width: 25, dates: dayRange(jam.publishedAt, jam.startDate) },
        { key: "jam", label: "Jam", index: 1, width: 75, dates: dayRange(jam.startDate, jam.endDate) },
      ] as const;
  const current = ORDER[phase];
  return defs.map((d) => {
    const state: TimelineState =
      current < 0 ? "future" : d.index < current ? "past" : d.index === current ? "current" : "future";
    let progress = state === "past" ? 100 : 0;
    if (state === "current") {
      progress = d.key === "upcoming" ? upcomingProgress(jam, now) : phaseProgress(jam, phase, now);
    }
    return { key: d.key, label: d.label, dates: d.dates, widthPct: d.width, state, progress };
  });
}

export function entryPanelState(input: {
  signedIn: boolean;
  phase: JamPhase;
  hasJoined: boolean;
  submission: { id: string; status: "DRAFT" | "SUBMITTED" } | null;
}): EntryPanel {
  const joinable = canJoin({ phase: input.phase, hasJoined: false }).allowed;
  if (!input.signedIn) return { kind: "signed-out", canJoin: joinable };
  if (input.submission) {
    return { kind: "has-entry", submissionId: input.submission.id, status: input.submission.status };
  }
  if (input.hasJoined) {
    const canCreate = canCreateSubmission({ phase: input.phase, hasJoined: true, hasSubmission: false }).allowed;
    return { kind: "joined", canCreate };
  }
  return joinable ? { kind: "can-join" } : { kind: "closed" };
}
