import { describe, it, expect } from "vitest";
import type { AccountBlocker, AccountDeletionPreview } from "@/domain/account";
import { blockerHref, blockerLinkLabel, describeAccountDeletion } from "@/lib/account-deletion";

const empty: AccountDeletionPreview = {
  leavingTeams: [],
  deletedSubmissions: [],
  deletedJams: [],
  leavingJams: 0,
  roles: 0,
  keptMemberships: 0,
};

describe("blockerHref and blockerLinkLabel", () => {
  const blockers: AccountBlocker[] = [
    { kind: "LED_TEAM", id: "s1", name: "Game", reason: "r" },
    { kind: "SOLE_ADMIN", id: "j1", slug: "spring-jam", name: "Spring", reason: "r" },
    { kind: "STAFF", id: "u1", name: "Staff role", reason: "r" },
  ];

  it("points each blocker at the page that resolves it", () => {
    expect(blockers.map(blockerHref)).toEqual(["/submissions/s1/edit", "/jams/spring-jam/manage", "/admin"]);
  });

  it("labels each link", () => {
    expect(blockers.map(blockerLinkLabel)).toEqual(["Manage team", "Manage roles", "Open admin"]);
  });
});

describe("describeAccountDeletion", () => {
  it("lists only the profile and the history for an account with nothing attached", () => {
    expect(describeAccountDeletion(empty, { ratings: 0, invites: 0 })).toEqual({
      removes: ["Your profile, email, password and linked sign-in accounts"],
      keeps: ["Past jam history, credited to “Deleted user”"],
    });
  });

  it("names what goes and what stays, with singular and plural forms", () => {
    const { removes, keeps } = describeAccountDeletion(
      {
        leavingTeams: [{ id: "a", title: "Alpha" }],
        deletedSubmissions: [
          { id: "b", title: "Beta" },
          { id: "c", title: "Gamma" },
        ],
        deletedJams: [{ id: "j", name: "Draft Jam" }],
        leavingJams: 2,
        roles: 1,
        keptMemberships: 3,
      },
      { ratings: 1, invites: 4 }
    );

    expect(removes).toEqual(
      expect.arrayContaining([
        "Your seat in 1 team that can still change: Alpha",
        "2 submissions you lead alone, moved to the trash: Beta, Gamma",
        "1 draft jam only you run, moved to the trash: Draft Jam",
        "Your 1 jam role",
        "Your spot in 2 jams that have not reached rating",
        "4 pending team invites, sent or received",
      ])
    );
    expect(removes).toHaveLength(7);
    expect(
      describeAccountDeletion({ ...empty, leavingJams: 1 }, { ratings: 0, invites: 0 }).removes
    ).toContain("Your spot in 1 jam that has not reached rating");
    expect(keeps).toEqual(
      expect.arrayContaining([
        "Your 1 rating, so results do not change",
        "Your seat in 3 teams in jams already rating or finished",
      ])
    );
    expect(keeps).toHaveLength(3);
  });
});
