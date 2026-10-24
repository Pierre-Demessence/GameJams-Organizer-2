import { describe, it, expect } from "vitest";
import { deleteAccountAction, linkPasswordAction } from "@/app/settings/actions";
import { updateProfileAction } from "@/app/settings/profile-actions";
import { grantSiteAdminAction } from "@/app/admin/actions";
import { assignRoleAction, searchUsersForRole } from "@/app/jams/[slug]/manage/actions";
import { inviteContributorAction } from "@/app/submissions/actions";
import { db } from "@/lib/db";
import { loadAccountDeletion } from "@/lib/account-queries";
import { actingAs, signOut } from "./current-session";
import {
  addMember,
  createFinishedJam,
  createInvite,
  createJam,
  createOngoingJam,
  createRatingJam,
  createSubmission,
  createUser,
  daysFromNow,
  grantJamRole,
  grantStaffRole,
  joinJam,
} from "./factories";

// A user with a profile, a password and a linked Discord account, ready to be deleted.
async function createProfileUser(username = "mira") {
  const user = await createUser(username);
  await db.account.create({
    data: { userId: user.id, type: "oauth", provider: "discord", providerAccountId: `d-${user.id}` },
  });
  return db.user.update({
    where: { id: user.id },
    data: {
      email: `${username}@example.com`,
      emailVerified: new Date(),
      passwordHash: "hash",
      displayName: "Mira",
      bio: "Hello",
      avatarUrl: "https://example.com/a.png",
    },
  });
}

const draftJam = (createdById: string) => createJam(createdById);

// Rows the deletion must not touch when it refuses.
async function snapshot(userId: string) {
  const [user, roles, members, participants] = await Promise.all([
    db.user.findUniqueOrThrow({ where: { id: userId } }),
    db.jamRole.count({ where: { userId } }),
    db.submissionMember.count({ where: { userId } }),
    db.jamParticipant.count({ where: { userId } }),
  ]);
  return { username: user.username, email: user.email, deletedAt: user.deletedAt, roles, members, participants };
}

describe("deleteAccountAction: refusals write nothing", () => {
  it("rejects a signed-out caller", async () => {
    signOut();
    expect(await deleteAccountAction("mira")).toEqual({ error: "Not authenticated." });
  });

  it("rejects a wrong or empty username", async () => {
    const user = await createProfileUser();
    actingAs(user.id);
    const before = await snapshot(user.id);

    expect(await deleteAccountAction("someone-else")).toEqual({ error: "That is not your username." });
    expect(await deleteAccountAction("  ")).toMatchObject({ error: expect.any(String) });
    expect(await snapshot(user.id)).toEqual(before);
  });

  it("accepts the username regardless of case and surrounding spaces", async () => {
    const user = await createProfileUser();
    actingAs(user.id);

    expect(await deleteAccountAction("  MIRA ")).toEqual({ success: true });
  });

  it("refuses a staff member", async () => {
    const user = await createProfileUser();
    await grantStaffRole(user.id);
    actingAs(user.id);
    const before = await snapshot(user.id);

    const result = await deleteAccountAction("mira");

    expect(result).toMatchObject({
      error: "Ask another admin to remove your staff role first",
      blockers: [{ kind: "STAFF" }],
    });
    expect(await snapshot(user.id)).toEqual(before);
  });

  it("refuses the leader of a team before RATING and names the submission", async () => {
    const user = await createProfileUser();
    const jam = await createOngoingJam((await createUser()).id);
    await joinJam(jam.id, user.id);
    const submission = await createSubmission(jam.id, user.id, { title: "Pixel Quest" });
    const mate = await createUser();
    await joinJam(jam.id, mate.id);
    await addMember(submission.id, mate.id);
    actingAs(user.id);
    const before = await snapshot(user.id);

    const result = await deleteAccountAction("mira");

    expect(result).toMatchObject({
      error: "Transfer leadership of Pixel Quest first",
      blockers: [{ kind: "LED_TEAM", id: submission.id, name: "Pixel Quest" }],
    });
    expect(await snapshot(user.id)).toEqual(before);
    expect(await db.submission.count({ where: { id: submission.id } })).toBe(1);
  });

  it("refuses the only Jam Admin of a published jam that is not finished and names the jam", async () => {
    const user = await createProfileUser();
    const jam = await createOngoingJam(user.id);
    await grantJamRole(jam.id, user.id, "ADMIN");
    actingAs(user.id);
    const before = await snapshot(user.id);

    const result = await deleteAccountAction("mira");

    expect(result).toMatchObject({ blockers: [{ kind: "SOLE_ADMIN", id: jam.id, name: jam.name, slug: jam.slug }] });
    expect(await snapshot(user.id)).toEqual(before);
    expect(await db.jam.count({ where: { id: jam.id } })).toBe(1);
  });

  it("reports every blocker at once and applies none of the other changes", async () => {
    const user = await createProfileUser();
    await grantStaffRole(user.id);
    const jam = await createOngoingJam(user.id);
    await grantJamRole(jam.id, user.id, "ADMIN");
    const draft = await draftJam(user.id);
    await grantJamRole(draft.id, user.id, "ADMIN");
    actingAs(user.id);

    const result = await deleteAccountAction("mira");

    expect(result).toMatchObject({ blockers: [{ kind: "STAFF" }, { kind: "SOLE_ADMIN" }] });
    expect(await db.jam.count({ where: { id: draft.id } })).toBe(1);
    expect(await db.account.count({ where: { userId: user.id } })).toBe(1);
  });

  it("lets a co-admin go once the other admin is in place", async () => {
    const user = await createProfileUser();
    const other = await createUser();
    const jam = await createOngoingJam(other.id);
    await grantJamRole(jam.id, user.id, "ADMIN");
    await grantJamRole(jam.id, other.id, "ADMIN");
    actingAs(user.id);

    expect(await deleteAccountAction("mira")).toEqual({ success: true });
    expect(await db.jamRole.count({ where: { jamId: jam.id } })).toBe(1);
  });

  it("does not let two co-admins delete at the same moment and leave the jam without one", async () => {
    const a = await createProfileUser("alice");
    const b = await createProfileUser("bob");
    const jam = await createOngoingJam(a.id);
    await grantJamRole(jam.id, a.id, "ADMIN");
    await grantJamRole(jam.id, b.id, "ADMIN");

    // The mocked auth() reads the acting user when the action starts, so each call keeps its own.
    actingAs(a.id);
    const first = deleteAccountAction("alice");
    actingAs(b.id);
    const second = deleteAccountAction("bob");
    const results = await Promise.all([first, second]);

    expect(results.filter((r) => "success" in r)).toHaveLength(1);
    expect(await db.jamRole.count({ where: { jamId: jam.id, role: "ADMIN" } })).toBe(1);
  });
});

describe("deleteAccountAction: a full deletion", () => {
  it("anonymizes the user, keeps history, removes the rest and frees the username and email", async () => {
    const user = await createProfileUser();
    const owner = await createUser("owner");

    // Before RATING: a non-leader team seat, a solo led submission and joined jams go away.
    const jamA = await createOngoingJam(owner.id);
    const jamB = await createOngoingJam(owner.id);
    const leaderA = await createUser();
    await joinJam(jamA.id, leaderA.id);
    await joinJam(jamA.id, user.id);
    const teamA = await createSubmission(jamA.id, leaderA.id);
    await addMember(teamA.id, user.id);
    await joinJam(jamB.id, user.id);
    const solo = await createSubmission(jamB.id, user.id, { title: "Solo" });

    // Roles: a draft jam only they run is deleted; a finished one stays; a judge seat just goes.
    const draft = await draftJam(user.id);
    await grantJamRole(draft.id, user.id, "ADMIN");
    const finished = await createFinishedJam(user.id);
    await grantJamRole(finished.id, user.id, "ADMIN");
    const judged = await createOngoingJam(owner.id);
    await grantJamRole(judged.id, user.id, "JUDGE");

    // In RATING: membership, participation and their ratings are frozen.
    const ratingJam = await createRatingJam(owner.id);
    const ratingLeader = await createUser();
    await joinJam(ratingJam.id, ratingLeader.id);
    await joinJam(ratingJam.id, user.id);
    const frozenTeam = await createSubmission(ratingJam.id, ratingLeader.id);
    await addMember(frozenTeam.id, user.id);
    const rivalLeader = await createUser();
    await joinJam(ratingJam.id, rivalLeader.id);
    const rival = await createSubmission(ratingJam.id, rivalLeader.id);
    const criterion = await db.criterion.create({ data: { jamId: ratingJam.id, name: "Fun" } });
    await db.rating.create({
      data: { submissionId: rival.id, criterionId: criterion.id, userId: user.id, score: 4 },
    });

    // Pending invites in both directions disappear.
    await createInvite(teamA.id, (await createUser()).id, user.id);
    await createInvite(teamA.id, user.id, leaderA.id);

    actingAs(user.id);
    const result = await deleteAccountAction("mira");
    expect(result).toEqual({ success: true });

    const tomb = await db.user.findUniqueOrThrow({ where: { id: user.id } });
    expect(tomb).toMatchObject({
      username: `deleted-${user.id}`,
      displayName: "Deleted user",
      email: null,
      emailVerified: null,
      passwordHash: null,
      bio: null,
      avatarUrl: null,
    });
    expect(tomb.deletedAt).toBeInstanceOf(Date);
    expect(await db.account.count({ where: { userId: user.id } })).toBe(0);

    // Removed.
    expect(await db.submissionMember.count({ where: { userId: user.id, submissionId: teamA.id } })).toBe(0);
    expect(await db.jamParticipant.count({ where: { userId: user.id, jamId: { in: [jamA.id, jamB.id] } } })).toBe(0);
    expect(await db.jamRole.count({ where: { userId: user.id } })).toBe(0);
    expect(await db.submissionInvite.count()).toBe(0);
    expect(await db.submission.count({ where: { id: solo.id } })).toBe(0);
    expect(await db.submission.count({ where: { id: solo.id, deletedAt: { not: null } } })).toBe(1);
    const trashed = await db.jam.findFirst({ where: { id: draft.id, deletedAt: { not: null } } });
    expect(trashed?.slug).toBe(`${draft.slug}__del__${draft.id}`);

    // Kept.
    expect(await db.jam.findUnique({ where: { id: finished.id } })).toMatchObject({ createdById: user.id });
    expect(await db.jam.count({ where: { id: judged.id } })).toBe(1);
    expect(await db.submissionMember.count({ where: { userId: user.id, submissionId: frozenTeam.id } })).toBe(1);
    expect(await db.jamParticipant.count({ where: { userId: user.id, jamId: ratingJam.id } })).toBe(1);
    expect(await db.rating.count({ where: { userId: user.id } })).toBe(1);
    expect(await db.submission.count({ where: { id: { in: [teamA.id, frozenTeam.id] } } })).toBe(2);

    // The username and email can be registered again.
    const again = await db.user.create({ data: { username: "mira", email: "mira@example.com" } });
    expect(again.id).not.toBe(user.id);
  });

  it("cannot be repeated by the same session", async () => {
    const user = await createProfileUser();
    actingAs(user.id);
    expect(await deleteAccountAction("mira")).toEqual({ success: true });

    expect(await deleteAccountAction(`deleted-${user.id}`)).toEqual({ error: "User not found." });
  });

  it("leaves the tombstone untouched when the still-valid session edits the profile or links a password", async () => {
    const user = await createProfileUser();
    actingAs(user.id);
    await deleteAccountAction("mira");
    const tombstone = await db.user.findUniqueOrThrow({ where: { id: user.id } });

    const profile = new FormData();
    profile.set("username", "resurrected");
    profile.set("displayName", "Back again");
    expect(await updateProfileAction(profile)).toEqual({ error: "User not found." });

    const credentials = new FormData();
    credentials.set("email", "back@example.com");
    credentials.set("password", "a-long-enough-password-1");
    expect(await linkPasswordAction(credentials)).toEqual({ error: "User not found." });

    expect(await db.user.findUniqueOrThrow({ where: { id: user.id } })).toEqual(tombstone);
  });
});

describe("deleted users are not found when someone is added", () => {
  // A deleted row that still carries its old username, so only the deletedAt filter can hide it.
  async function deletedUser(username: string) {
    const user = await createUser(username);
    return db.user.update({ where: { id: user.id }, data: { deletedAt: new Date() } });
  }

  it("by invite, jam role and staff grant, and in role search", async () => {
    const owner = await createUser();
    const jam = await createOngoingJam(owner.id);
    await grantJamRole(jam.id, owner.id, "ADMIN");
    const leader = await createUser();
    await joinJam(jam.id, leader.id);
    const submission = await createSubmission(jam.id, leader.id);
    const ghost = await deletedUser("ghostly");
    await joinJam(jam.id, ghost.id);

    actingAs(leader.id);
    expect(await inviteContributorAction(submission.id, "ghostly")).toEqual({ error: "User not found" });

    actingAs(owner.id);
    expect(await assignRoleAction(jam.id, "ghostly", "JUDGE")).toEqual({ error: "User not found" });
    expect(await searchUsersForRole("ghost")).toEqual({ users: [] });

    const admin = await createUser();
    await grantStaffRole(admin.id);
    actingAs(admin.id);
    expect(await grantSiteAdminAction("ghostly")).toMatchObject({ error: expect.any(String) });
    expect(await db.staffRole.count({ where: { userId: ghost.id } })).toBe(0);
  });
});

describe("loadAccountDeletion", () => {
  it("returns null for a missing or deleted user", async () => {
    expect(await loadAccountDeletion(db, "missing")).toBeNull();
    const user = await createUser();
    await db.user.update({ where: { id: user.id }, data: { deletedAt: new Date() } });
    expect(await loadAccountDeletion(db, user.id)).toBeNull();
  });

  it("loads phases, team sizes, admin counts and counts, skipping trashed jams", async () => {
    const user = await createProfileUser();
    const other = await createUser();
    const jam = await createOngoingJam(other.id);
    await joinJam(jam.id, user.id);
    const team = await createSubmission(jam.id, user.id, { title: "Team game" });
    await addMember(team.id, other.id);
    await grantJamRole(jam.id, user.id, "ADMIN");
    await grantJamRole(jam.id, other.id, "ADMIN");
    await grantJamRole(jam.id, other.id, "JUDGE");
    const upcoming = await createJam(user.id, {
      publishedAt: daysFromNow(-1),
      startDate: daysFromNow(2),
      endDate: daysFromNow(3),
    });
    await grantJamRole(upcoming.id, user.id, "ADMIN");
    const trashed = await createOngoingJam(other.id);
    await grantJamRole(trashed.id, user.id, "ADMIN");
    await db.jam.update({ where: { id: trashed.id }, data: { deletedAt: new Date() } });
    await createInvite(team.id, (await createUser()).id, user.id);

    const data = await loadAccountDeletion(db, user.id);

    expect(data).toMatchObject({ username: "mira", ratingCount: 0, inviteCount: 1 });
    expect(data?.input).toMatchObject({ userId: user.id, isStaff: false });
    expect(data?.input.memberships).toEqual([
      {
        submissionId: team.id,
        title: "Team game",
        phase: "ONGOING",
        isLeader: true,
        memberCount: 2,
        submissionDeletedAt: null,
      },
    ]);
    expect(data?.input.participations).toEqual([{ jamId: jam.id, phase: "ONGOING" }]);
    const roles = data?.input.jamRoles ?? [];
    expect(roles.map((r) => r.jamId).sort()).toEqual([jam.id, upcoming.id].sort());
    expect(roles.find((r) => r.jamId === jam.id)).toMatchObject({ role: "ADMIN", phase: "ONGOING", adminCount: 2 });
    expect(roles.find((r) => r.jamId === upcoming.id)).toMatchObject({ phase: "UPCOMING", adminCount: 1 });
  });

  it("reports a deleted submission instead of hiding it", async () => {
    const user = await createProfileUser();
    const jam = await createOngoingJam((await createUser()).id);
    await joinJam(jam.id, user.id);
    const submission = await createSubmission(jam.id, user.id);
    await db.submission.update({ where: { id: submission.id }, data: { deletedAt: new Date() } });

    const data = await loadAccountDeletion(db, user.id);

    expect(data?.input.memberships).toMatchObject([{ submissionId: submission.id }]);
    expect(data?.input.memberships[0].submissionDeletedAt).toBeInstanceOf(Date);
  });
});
