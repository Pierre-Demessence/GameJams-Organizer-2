import { describe, it, expect } from "vitest";
import {
  acceptInviteAction,
  cancelInviteAction,
  createSubmissionAction,
  declineInviteAction,
  inviteContributorAction,
} from "@/app/submissions/actions";
import { db } from "@/lib/db";
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
  joinJam,
  submissionFormData,
} from "./factories";

// A leader with a draft submission in a fresh ongoing jam, plus a joined invitee.
async function setup() {
  const owner = await createUser();
  const jam = await createOngoingJam(owner.id);
  const leader = await createUser();
  const invitee = await createUser("invitee");
  await joinJam(jam.id, leader.id);
  await joinJam(jam.id, invitee.id);
  const submission = await createSubmission(jam.id, leader.id);
  return { owner, jam, leader, invitee, submission };
}

const pending = (submissionId: string) => db.submissionInvite.findMany({ where: { submissionId } });

describe("inviteContributorAction", () => {
  it("creates a pending invite without adding the member", async () => {
    const { leader, invitee, submission } = await setup();
    actingAs(leader.id);

    const res = await inviteContributorAction(submission.id, "invitee");

    expect(res.success).toBe(true);
    expect(await pending(submission.id)).toMatchObject([{ inviteeId: invitee.id, invitedById: leader.id }]);
    expect(await db.submissionMember.count({ where: { submissionId: submission.id } })).toBe(1);
  });

  it("lets any member invite, but not an outsider", async () => {
    const { jam, submission } = await setup();
    const contributor = await createUser();
    const outsider = await createUser();
    await addMember(submission.id, contributor.id);
    await joinJam(jam.id, (await createUser("third")).id);

    actingAs(outsider.id);
    expect((await inviteContributorAction(submission.id, "third")).error).toMatch(/team members/i);
    actingAs(contributor.id);
    expect((await inviteContributorAction(submission.id, "third")).success).toBe(true);
  });

  it("rejects a signed-out user and an unknown submission or user", async () => {
    const { leader, submission } = await setup();
    signOut();
    expect((await inviteContributorAction(submission.id, "invitee")).error).toMatch(/signed in/i);

    actingAs(leader.id);
    expect((await inviteContributorAction("missing", "invitee")).error).toMatch(/not found/i);
    expect((await inviteContributorAction(submission.id, "nobody")).error).toMatch(/not found/i);
  });

  it("rejects an invitee who has not joined, is in a live submission, or is already invited", async () => {
    const { jam, leader, submission } = await setup();
    await createUser("stranger");
    const busy = await createUser("busy");
    await joinJam(jam.id, busy.id);
    await createSubmission(jam.id, busy.id);
    actingAs(leader.id);

    expect((await inviteContributorAction(submission.id, "stranger")).error).toMatch(/join/i);
    expect((await inviteContributorAction(submission.id, "busy")).error).toMatch(/already part/i);
    expect((await inviteContributorAction(submission.id, "invitee")).success).toBe(true);
    expect((await inviteContributorAction(submission.id, "invitee")).error).toMatch(/already invited/i);
    expect(await pending(submission.id)).toHaveLength(1);
  });

  it("counts pending invites against the maximum team size", async () => {
    const { jam, leader, submission } = await setup();
    await db.jam.update({ where: { id: jam.id }, data: { maxTeamSize: 2 } });
    await joinJam(jam.id, (await createUser("second")).id);
    actingAs(leader.id);

    expect((await inviteContributorAction(submission.id, "invitee")).success).toBe(true);
    expect((await inviteContributorAction(submission.id, "second")).error).toMatch(/maximum size/i);
  });

  it("refuses once the window has closed", async () => {
    const owner = await createUser();
    const jam = await createFinishedJam(owner.id);
    const leader = await createUser();
    const invitee = await createUser("invitee");
    await joinJam(jam.id, invitee.id);
    const submission = await createSubmission(jam.id, leader.id);
    actingAs(leader.id);

    expect((await inviteContributorAction(submission.id, "invitee")).error).toMatch(/no longer/i);
  });

  it("stays open during RATING only when the ranked jam allows late contributors", async () => {
    const owner = await createUser();
    const closedLeader = await createUser();
    const openLeader = await createUser();
    const invitee = await createUser("invitee");
    const closed = await createRatingJam(owner.id);
    const open = await createRatingJam(owner.id, { allowContributorsAfterClose: true });
    const closedSub = await createSubmission(closed.id, closedLeader.id);
    const openSub = await createSubmission(open.id, openLeader.id);
    await joinJam(closed.id, invitee.id);
    await joinJam(open.id, invitee.id);

    actingAs(closedLeader.id);
    expect((await inviteContributorAction(closedSub.id, "invitee")).error).toMatch(/no longer/i);
    actingAs(openLeader.id);
    expect((await inviteContributorAction(openSub.id, "invitee")).success).toBe(true);
  });

  it("does not see a deleted submission", async () => {
    const { leader, submission } = await setup();
    await db.submission.update({ where: { id: submission.id }, data: { deletedAt: new Date() } });
    actingAs(leader.id);

    expect((await inviteContributorAction(submission.id, "invitee")).error).toMatch(/not found/i);
  });
});

describe("cancelInviteAction and declineInviteAction", () => {
  it("lets any member cancel, and nobody else", async () => {
    const { leader, invitee, submission } = await setup();
    const contributor = await createUser();
    await addMember(submission.id, contributor.id);
    const outsider = await createUser();
    const invite = await createInvite(submission.id, invitee.id, leader.id);

    actingAs(outsider.id);
    expect((await cancelInviteAction(invite.id)).error).toMatch(/not found/i);
    actingAs(contributor.id);
    expect((await cancelInviteAction(invite.id)).success).toBe(true);
    expect(await pending(submission.id)).toHaveLength(0);
  });

  it("lets only the invitee decline", async () => {
    const { leader, invitee, submission } = await setup();
    const invite = await createInvite(submission.id, invitee.id, leader.id);

    actingAs(leader.id);
    expect((await declineInviteAction(invite.id)).error).toMatch(/not found/i);
    actingAs(invitee.id);
    expect((await declineInviteAction(invite.id)).success).toBe(true);
    expect(await pending(submission.id)).toHaveLength(0);
  });

  it("reports an invite that no longer exists", async () => {
    const { invitee } = await setup();
    actingAs(invitee.id);

    expect((await declineInviteAction("gone")).error).toMatch(/not found/i);
    expect((await cancelInviteAction("gone")).error).toMatch(/not found/i);
  });
});

describe("acceptInviteAction", () => {
  it("adds a non-leader member and deletes every pending invite in that jam", async () => {
    const { owner, jam, leader, invitee, submission } = await setup();
    const rival = await createUser();
    await joinJam(jam.id, rival.id);
    const other = await createSubmission(jam.id, rival.id);
    const elsewhere = await createOngoingJam(owner.id);
    const foreign = await createSubmission(elsewhere.id, leader.id);
    await joinJam(elsewhere.id, invitee.id);
    const invite = await createInvite(submission.id, invitee.id, leader.id);
    await createInvite(other.id, invitee.id, rival.id);
    await createInvite(foreign.id, invitee.id, leader.id);
    actingAs(invitee.id);

    const res = await acceptInviteAction(invite.id);

    expect(res.success).toBe(true);
    const member = await db.submissionMember.findFirst({
      where: { submissionId: submission.id, userId: invitee.id },
    });
    expect(member?.isLeader).toBe(false);
    expect(await pending(other.id)).toHaveLength(0);
    expect(await pending(submission.id)).toHaveLength(0);
    expect(await pending(foreign.id)).toHaveLength(1);
  });

  it("only works for the invitee", async () => {
    const { leader, invitee, submission } = await setup();
    const invite = await createInvite(submission.id, invitee.id, leader.id);

    actingAs(leader.id);
    expect((await acceptInviteAction(invite.id)).error).toMatch(/not found/i);
    signOut();
    expect((await acceptInviteAction(invite.id)).error).toMatch(/signed in/i);
  });

  it("refuses after the window closes and keeps the invite pending", async () => {
    const { jam, leader, invitee, submission } = await setup();
    const invite = await createInvite(submission.id, invitee.id, leader.id);
    await db.jam.update({
      where: { id: jam.id },
      data: { endDate: new Date(Date.now() - 1000), startDate: new Date(Date.now() - 86_400_000) },
    });
    actingAs(invitee.id);

    expect((await acceptInviteAction(invite.id)).error).toMatch(/no longer/i);
    expect(await pending(submission.id)).toHaveLength(1);
  });

  it("refuses when the invitee has since joined another team", async () => {
    const { jam, leader, invitee, submission } = await setup();
    const invite = await createInvite(submission.id, invitee.id, leader.id);
    await createSubmission(jam.id, invitee.id);
    actingAs(invitee.id);

    expect((await acceptInviteAction(invite.id)).error).toMatch(/already have a submission/i);
  });

  it("refuses when the invitee left the jam", async () => {
    const { jam, leader, invitee, submission } = await setup();
    const invite = await createInvite(submission.id, invitee.id, leader.id);
    await db.jamParticipant.deleteMany({ where: { jamId: jam.id, userId: invitee.id } });
    actingAs(invitee.id);

    expect((await acceptInviteAction(invite.id)).error).toMatch(/join/i);
  });

  it("refuses when the team is full of members", async () => {
    const { jam, leader, invitee, submission } = await setup();
    await db.jam.update({ where: { id: jam.id }, data: { maxTeamSize: 2 } });
    const invite = await createInvite(submission.id, invitee.id, leader.id);
    await addMember(submission.id, (await createUser()).id);
    actingAs(invitee.id);

    expect((await acceptInviteAction(invite.id)).error).toMatch(/maximum size/i);
  });

  it("still accepts when other pending invites would fill the team", async () => {
    const { jam, leader, invitee, submission } = await setup();
    await db.jam.update({ where: { id: jam.id }, data: { maxTeamSize: 2 } });
    const second = await createUser();
    await joinJam(jam.id, second.id);
    const invite = await createInvite(submission.id, invitee.id, leader.id);
    await createInvite(submission.id, second.id, leader.id);
    actingAs(invitee.id);

    expect((await acceptInviteAction(invite.id)).success).toBe(true);
  });

  it("refuses the invites of a deleted submission", async () => {
    const { leader, invitee, submission } = await setup();
    const invite = await createInvite(submission.id, invitee.id, leader.id);
    await db.submission.update({ where: { id: submission.id }, data: { deletedAt: new Date() } });
    actingAs(invitee.id);

    expect((await acceptInviteAction(invite.id)).error).toMatch(/not found/i);
  });

  it("seats only one of two concurrent accepts for the last place", async () => {
    const { jam, leader, invitee, submission } = await setup();
    await db.jam.update({ where: { id: jam.id }, data: { maxTeamSize: 2 } });
    const second = await createUser();
    await joinJam(jam.id, second.id);
    const inviteA = await createInvite(submission.id, invitee.id, leader.id);
    const inviteB = await createInvite(submission.id, second.id, leader.id);

    // The mocked auth() reads the acting user when the action starts, so each call keeps its own.
    actingAs(invitee.id);
    const first = acceptInviteAction(inviteA.id);
    actingAs(second.id);
    const other = acceptInviteAction(inviteB.id);
    const results = await Promise.all([first, other]);

    expect(results.filter((r) => r.success)).toHaveLength(1);
    expect(await db.submissionMember.count({ where: { submissionId: submission.id } })).toBe(2);
  });

  it("joins only one team when one user accepts two invites concurrently", async () => {
    const { jam, leader, invitee, submission } = await setup();
    const rival = await createUser();
    await joinJam(jam.id, rival.id);
    const other = await createSubmission(jam.id, rival.id);
    const inviteA = await createInvite(submission.id, invitee.id, leader.id);
    const inviteB = await createInvite(other.id, invitee.id, rival.id);

    actingAs(invitee.id);
    const results = await Promise.all([acceptInviteAction(inviteA.id), acceptInviteAction(inviteB.id)]);

    expect(results.filter((r) => r.success)).toHaveLength(1);
    expect(
      await db.submissionMember.count({ where: { userId: invitee.id, submission: { jamId: jam.id } } })
    ).toBe(1);
  });
});

describe("createSubmissionAction and pending invites", () => {
  it("deletes the creator's pending invites in that jam only", async () => {
    const { owner, jam, leader, invitee, submission } = await setup();
    const elsewhere = await createOngoingJam(owner.id);
    await joinJam(elsewhere.id, invitee.id);
    const foreign = await createSubmission(elsewhere.id, leader.id);
    await createInvite(submission.id, invitee.id, leader.id);
    await createInvite(foreign.id, invitee.id, leader.id);
    actingAs(invitee.id);

    const res = await createSubmissionAction(jam.slug, submissionFormData());

    expect(res.success).toBe(true);
    expect(await pending(submission.id)).toHaveLength(0);
    expect(await pending(foreign.id)).toHaveLength(1);
  });

  it("keeps invites when the creation is refused", async () => {
    const owner = await createUser();
    const jam = await createJam(owner.id);
    const leader = await createUser();
    const invitee = await createUser();
    await joinJam(jam.id, invitee.id);
    const submission = await createSubmission(jam.id, leader.id);
    await createInvite(submission.id, invitee.id, leader.id);
    actingAs(invitee.id);

    expect((await createSubmissionAction(jam.slug, submissionFormData())).error).toMatch(/ongoing/i);
    expect(await pending(submission.id)).toHaveLength(1);
  });
});

describe("invite rate limits", () => {
  const actions: [string, () => Promise<{ error?: string }>][] = [
    ["invite", () => inviteContributorAction("missing", "nobody")],
    ["cancel", () => cancelInviteAction("missing")],
    ["accept", () => acceptInviteAction("missing")],
    ["decline", () => declineInviteAction("missing")],
  ];

  it.each(actions)("throttles %s", async (_name, run) => {
    const user = await createUser();
    actingAs(user.id);

    const results = [];
    for (let i = 0; i < 11; i++) results.push(await run());

    expect(results[9].error).not.toMatch(/too many/i);
    expect(results[10].error).toMatch(/too many/i);
  });
});
