import { checkCriteria, validateJamDates, type PublishCriterion } from "@/domain/jam-phase";
import { formatDuration } from "@/lib/jam-status-display";
import { dayRange } from "@/lib/jam-page";
import { slugPattern } from "@/lib/validations";

export function slugify(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60)
    .replace(/-+$/, "");
}

export interface ScheduleInput {
  startDate: Date | null;
  endDate: Date | null;
  ratingEnd: Date | null;
  ranked: boolean;
}

// The bar under the dates: jam and rating windows drawn to scale.
export function scheduleSummary(s: ScheduleInput): { jamPct: number; text: string } | null {
  const { startDate, endDate, ratingEnd, ranked } = s;
  if (!startDate || !endDate || endDate <= startDate) return null;
  const jam = `${formatDuration(startDate, endDate)} of jamming`;
  if (!ranked || !ratingEnd || ratingEnd <= endDate) {
    return { jamPct: 100, text: `${jam} · ${dayRange(startDate, endDate)}` };
  }
  const total = ratingEnd.getTime() - startDate.getTime();
  const jamPct = Math.round(((endDate.getTime() - startDate.getTime()) / total) * 100);
  return {
    jamPct: Math.min(95, Math.max(5, jamPct)),
    text: `${jam}, then ${formatDuration(endDate, ratingEnd)} of rating · ${dayRange(startDate, ratingEnd)}`,
  };
}

export type CheckState = "done" | "todo" | "optional";
export interface Check {
  key: string;
  label: string;
  // The form section the item links to.
  section: string;
  state: CheckState;
  hint?: string;
}

export interface ChecklistInput extends ScheduleInput {
  name: string;
  slug: string;
  shortDesc: string;
  fullDesc: string;
  coverUrl: string;
  theme: string;
  criteria: PublishCriterion[];
  customFieldCount: number;
}

// Mirrors canPublish() so the panel and the server agree; theme, questions and cover are
// recommendations, never blockers.
export function publishChecklist(input: ChecklistInput): { checks: Check[]; ready: boolean } {
  const basicsDone =
    input.name.trim() !== "" &&
    slugPattern.test(input.slug) &&
    input.shortDesc.trim() !== "" &&
    input.fullDesc.trim() !== "";
  const dates = validateJamDates(input, { requireComplete: true });
  const required: Check[] = [
    { key: "basics", label: "Name, URL and description", section: "basics", state: basicsDone ? "done" : "todo" },
    {
      key: "dates",
      label: "Dates in order",
      section: "schedule",
      state: dates.allowed ? "done" : "todo",
      hint: dates.allowed ? undefined : dates.reason,
    },
  ];
  if (input.ranked) {
    const criteria = checkCriteria(input.criteria);
    required.push({
      key: "criteria",
      label: "At least one criterion",
      section: "rating",
      state: criteria.allowed ? "done" : "todo",
      hint: criteria.allowed ? undefined : criteria.reason,
    });
  }
  const recommended = (key: string, label: string, section: string, done: boolean): Check => ({
    key,
    label,
    section,
    state: done ? "done" : "optional",
  });
  const checks = [
    ...required,
    recommended("theme", "Theme", "theme", input.theme.trim() !== ""),
    recommended("questions", "Custom questions", "submissions", input.customFieldCount > 0),
    recommended("cover", "Cover image", "basics", input.coverUrl.trim() !== ""),
  ];
  return { checks, ready: required.every((c) => c.state === "done") };
}
