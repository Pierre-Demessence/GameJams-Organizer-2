import type { RatingEligibility } from "@/domain/rating";

const ELIGIBILITY: Record<RatingEligibility, string> = {
  SUBMITTERS_ONLY: "Team leaders only",
  SUBMITTERS_AND_CONTRIBUTORS: "All team members",
  JUDGES_ONLY: "Judges only",
  EVERYONE: "Everyone signed in",
};

export function ratingEligibilityLabel(e: RatingEligibility): string {
  return ELIGIBILITY[e];
}

const ROLES = { ADMIN: "Admin", MODERATOR: "Moderator", JUDGE: "Judge", HOST: "Host" } as const;

export function jamRoleLabel(role: keyof typeof ROLES): string {
  return ROLES[role];
}

const PLATFORMS = { WINDOWS: "Windows", MAC: "Mac", LINUX: "Linux", WEB: "Web" } as const;

export function platformLabel(p: keyof typeof PLATFORMS): string {
  return PLATFORMS[p];
}
