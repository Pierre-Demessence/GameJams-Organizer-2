import type { AccountBlocker, AccountDeletionPreview } from "@/domain/account";

// Where the user can resolve a blocker.
export function blockerHref(blocker: AccountBlocker): string {
  switch (blocker.kind) {
    case "LED_TEAM":
      return `/submissions/${blocker.id}/edit`;
    case "SOLE_ADMIN":
      return `/jams/${blocker.slug}/manage`;
    case "STAFF":
      return "/admin";
  }
}

export function blockerLinkLabel(blocker: AccountBlocker): string {
  switch (blocker.kind) {
    case "LED_TEAM":
      return "Manage team";
    case "SOLE_ADMIN":
      return "Manage roles";
    case "STAFF":
      return "Open admin";
  }
}

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
const titles = (items: { title: string }[]) => items.map((i) => i.title).join(", ");
const names = (items: { name: string }[]) => items.map((i) => i.name).join(", ");

export interface DeletionSummary {
  removes: string[];
  keeps: string[];
}

// The plain-words lists on the confirmation screen, so the user sees the effect before typing.
export function describeAccountDeletion(
  preview: AccountDeletionPreview,
  counts: { ratings: number; invites: number }
): DeletionSummary {
  const removes = ["Your profile, email, password and linked sign-in accounts"];
  if (preview.leavingTeams.length > 0) {
    removes.push(
      `Your seat in ${plural(preview.leavingTeams.length, "team")} that can still change: ${titles(preview.leavingTeams)}`
    );
  }
  if (preview.deletedSubmissions.length > 0) {
    removes.push(
      `${plural(preview.deletedSubmissions.length, "submission")} you lead alone, moved to the trash: ${titles(preview.deletedSubmissions)}`
    );
  }
  if (preview.deletedJams.length > 0) {
    removes.push(
      `${plural(preview.deletedJams.length, "draft jam")} only you run, moved to the trash: ${names(preview.deletedJams)}`
    );
  }
  if (preview.roles > 0) removes.push(`Your ${plural(preview.roles, "jam role")}`);
  if (preview.leavingJams > 0) {
    removes.push(
      `Your spot in ${plural(preview.leavingJams, "jam")} that ${preview.leavingJams === 1 ? "has" : "have"} not reached rating`
    );
  }
  if (counts.invites > 0) removes.push(`${plural(counts.invites, "pending team invite")}, sent or received`);

  const keeps = ["Past jam history, credited to “Deleted user”"];
  if (counts.ratings > 0) keeps.push(`Your ${plural(counts.ratings, "rating")}, so results do not change`);
  if (preview.keptMemberships > 0) {
    keeps.push(`Your seat in ${plural(preview.keptMemberships, "team")} in jams already rating or finished`);
  }
  return { removes, keeps };
}
