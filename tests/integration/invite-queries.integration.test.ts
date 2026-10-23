import { describe, it, expect } from "vitest";
import { db } from "@/lib/db";
import { loadSubmissionInvites, loadViewerInvites } from "@/lib/invite-queries";
import {
  createInvite,
  createOngoingJam,
  createRatingJam,
  createSubmission,
  createUser,
  joinJam,
} from "./factories";

describe("loadSubmissionInvites", () => {
  it("lists the pending invitees of a team in invite order", async () => {
    const owner = await createUser();
    const jam = await createOngoingJam(owner.id);
    const leader = await createUser();
    const first = await createUser("first");
    const second = await createUser("second");
    const submission = await createSubmission(jam.id, leader.id);
    await createInvite(submission.id, first.id, leader.id);
    await createInvite(submission.id, second.id, leader.id);

    const invites = await loadSubmissionInvites(submission.id);

    expect(invites.map((i) => i.username)).toEqual(["first", "second"]);
    expect(invites[0]).toMatchObject({ displayName: null });
  });

  it("hides invites once the window closes or the submission is deleted", async () => {
    const owner = await createUser();
    const leader = await createUser();
    const invitee = await createUser("invitee");
    const closed = await createRatingJam(owner.id);
    const open = await createRatingJam(owner.id, { allowContributorsAfterClose: true });
    const live = await createOngoingJam(owner.id);
    const closedSub = await createSubmission(closed.id, leader.id);
    const openSub = await createSubmission(open.id, leader.id);
    const deletedSub = await createSubmission(live.id, leader.id);
    for (const s of [closedSub, openSub, deletedSub]) await createInvite(s.id, invitee.id, leader.id);
    await db.submission.update({ where: { id: deletedSub.id }, data: { deletedAt: new Date() } });

    expect(await loadSubmissionInvites(closedSub.id)).toEqual([]);
    expect(await loadSubmissionInvites(openSub.id)).toHaveLength(1);
    expect(await loadSubmissionInvites(deletedSub.id)).toEqual([]);
  });
});

describe("loadViewerInvites", () => {
  it("lists the viewer's pending invites in this jam with title and inviter", async () => {
    const owner = await createUser();
    const jam = await createOngoingJam(owner.id);
    const elsewhere = await createOngoingJam(owner.id);
    const leader = await createUser("leader");
    await db.user.update({ where: { id: leader.id }, data: { displayName: "Lead Dev" } });
    const invitee = await createUser();
    const mine = await createSubmission(jam.id, leader.id, { title: "Space Game" });
    const foreign = await createSubmission(elsewhere.id, leader.id);
    await createInvite(mine.id, invitee.id, leader.id);
    await createInvite(foreign.id, invitee.id, leader.id);

    const invites = await loadViewerInvites(jam, invitee.id);

    expect(invites).toMatchObject([{ submissionTitle: "Space Game", inviterName: "Lead Dev" }]);
    expect(await loadViewerInvites(jam, owner.id)).toEqual([]);
  });

  it("skips deleted submissions and closed windows", async () => {
    const owner = await createUser();
    const leader = await createUser();
    const invitee = await createUser();
    const live = await createOngoingJam(owner.id);
    const closed = await createRatingJam(owner.id);
    await joinJam(live.id, invitee.id);
    const deleted = await createSubmission(live.id, leader.id);
    const frozen = await createSubmission(closed.id, leader.id);
    await createInvite(deleted.id, invitee.id, leader.id);
    await createInvite(frozen.id, invitee.id, leader.id);
    await db.submission.update({ where: { id: deleted.id }, data: { deletedAt: new Date() } });

    expect(await loadViewerInvites(live, invitee.id)).toEqual([]);
    expect(await loadViewerInvites(closed, invitee.id)).toEqual([]);
  });
});
