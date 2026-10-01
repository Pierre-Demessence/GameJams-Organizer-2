export interface ModerationState {
  visible: boolean;
  rateable: boolean;
  competing: boolean;
}

export type ModerationFlag = "Hidden" | "Disqualified" | "Not competing";

// The badge shown next to a moderated entry; hiding wins because it removes the entry from
// every public page.
export function moderationFlag(s: ModerationState): ModerationFlag | null {
  if (!s.visible) return "Hidden";
  if (!s.rateable && !s.competing) return "Disqualified";
  if (!s.competing) return "Not competing";
  return null;
}

export type ManageStatusFilter = "all" | "submitted" | "draft" | "flagged";

export interface ManageRow extends ModerationState {
  title: string;
  status: "DRAFT" | "SUBMITTED";
  team: string[];
}

export function filterManageRows<T extends ManageRow>(rows: T[], query: string, status: ManageStatusFilter): T[] {
  const q = query.trim().toLowerCase();
  return rows.filter((r) => {
    if (status === "submitted" && r.status !== "SUBMITTED") return false;
    if (status === "draft" && r.status !== "DRAFT") return false;
    if (status === "flagged" && !moderationFlag(r)) return false;
    if (!q) return true;
    return r.title.toLowerCase().includes(q) || r.team.some((m) => m.toLowerCase().includes(q));
  });
}

const DAY = new Intl.DateTimeFormat("en", { month: "short", day: "2-digit", timeZone: "UTC" });

export interface ResultsBanner {
  title: string;
  text: string;
  // Reveal is offered only once rating has ended (canRevealResults).
  canReveal: boolean;
}

export function resultsBanner(jam: {
  ranked: boolean;
  phase: "DRAFT" | "UPCOMING" | "ONGOING" | "RATING" | "FINISHED";
  hideResults: boolean;
  resultsRevealedAt: Date | null;
  ratingEnd: Date | null;
}): ResultsBanner | null {
  if (!jam.ranked || (jam.phase !== "RATING" && jam.phase !== "FINISHED")) return null;
  const ends = jam.ratingEnd ? `Rating ends ${DAY.format(jam.ratingEnd)}. ` : "";
  const held = jam.hideResults && !jam.resultsRevealedAt;
  if (jam.phase === "FINISHED") {
    return held
      ? { title: "Results are hidden", text: "Rating has ended. Reveal the ranking to everyone when you're ready.", canReveal: true }
      : { title: "Results are public", text: "Everyone can see the ranking.", canReveal: false };
  }
  return held
    ? {
        title: "Results are hidden",
        text: `${ends}Preview the live ranking now; reveal it to everyone once rating ends.`,
        canReveal: false,
      }
    : { title: "Results go public when rating ends", text: `${ends}Preview the live ranking now.`, canReveal: false };
}
