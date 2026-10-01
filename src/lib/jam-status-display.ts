import type { JamPhase, JamPhaseInput } from "@/domain/jam-phase";

export type JamStatusTone = "draft" | "upcoming" | "live" | "rating" | "finished";

const STATUS: Record<JamPhase, { label: string; tone: JamStatusTone }> = {
  DRAFT: { label: "Draft", tone: "draft" },
  UPCOMING: { label: "Upcoming", tone: "upcoming" },
  ONGOING: { label: "Live", tone: "live" },
  RATING: { label: "Rating", tone: "rating" },
  FINISHED: { label: "Finished", tone: "finished" },
};

export function jamStatus(phase: JamPhase) {
  return STATUS[phase];
}

export const TONE_TEXT: Record<JamStatusTone, string> = {
  draft: "text-muted-foreground",
  upcoming: "text-brand",
  live: "text-live",
  rating: "text-rating",
  finished: "text-finished",
};

export const TONE_BG: Record<JamStatusTone, string> = {
  draft: "bg-muted-foreground",
  upcoming: "bg-brand",
  live: "bg-live",
  rating: "bg-rating",
  finished: "bg-finished",
};

export const TONE_PILL: Record<JamStatusTone, string> = {
  draft: "border border-dashed border-input",
  upcoming: "bg-brand/12",
  live: "bg-live/12",
  rating: "bg-rating/12",
  finished: "bg-finished/15",
};

export function nextDeadline(
  jam: JamPhaseInput,
  phase: JamPhase
): { label: string; at: Date } | null {
  if (phase === "UPCOMING" && jam.startDate) return { label: "Starts", at: jam.startDate };
  if (phase === "ONGOING" && jam.endDate) return { label: "Submissions close", at: jam.endDate };
  if (phase === "RATING" && jam.ratingEnd) return { label: "Rating closes", at: jam.ratingEnd };
  return null;
}

function windowProgress(from: Date | null, to: Date | null, now: Date): number {
  if (!from || !to) return 0;
  const span = to.getTime() - from.getTime();
  // Invalid Dates make every getTime() NaN; show an empty bar rather than NaN%.
  if (!Number.isFinite(span) || !Number.isFinite(now.getTime())) return 0;
  if (span <= 0) return 100;
  const pct = ((now.getTime() - from.getTime()) / span) * 100;
  return Math.min(100, Math.max(0, Math.round(pct)));
}

export function phaseProgress(jam: JamPhaseInput, phase: JamPhase, now = new Date()): number {
  if (phase === "ONGOING") return windowProgress(jam.startDate, jam.endDate, now);
  if (phase === "RATING") return windowProgress(jam.endDate, jam.ratingEnd, now);
  if (phase === "FINISHED") return 100;
  return 0;
}

const pad = (n: number) => String(n).padStart(2, "0");

function parts(ms: number) {
  const total = Number.isFinite(ms) && ms > 0 ? Math.floor(ms / 1000) : 0;
  return {
    days: Math.floor(total / 86_400),
    hours: Math.floor((total % 86_400) / 3_600),
    minutes: Math.floor((total % 3_600) / 60),
    seconds: total % 60,
  };
}

export function formatCountdown(ms: number): string {
  const { days, hours, minutes, seconds } = parts(ms);
  const hms = `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
  return days > 0 ? `${days}d ${hms}` : hms;
}

export function formatTimeLeftShort(ms: number): string {
  const { days, hours, minutes } = parts(ms);
  return days > 0 ? `${days}d ${pad(hours)}h` : `${pad(hours)}h ${pad(minutes)}m`;
}

export function formatDuration(start: Date, end: Date): string {
  const ms = end.getTime() - start.getTime();
  if (!Number.isFinite(ms)) return "—";
  const hours = Math.max(0, Math.round(ms / 3_600_000));
  if (hours <= 72) return `${hours} ${hours === 1 ? "hour" : "hours"}`;
  return `${Math.round(hours / 24)} days`;
}
