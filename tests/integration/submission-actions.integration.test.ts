import { describe, it, expect } from "vitest";
import {
  acceptInviteAction,
  createSubmissionAction,
  deleteSubmissionAction,
  inviteContributorAction,
  leaveSubmissionAction,
  removeContributorAction,
  transferLeaderAction,
  updateSubmissionAction,
} from "@/app/submissions/actions";
import { db } from "@/lib/db";
import { actingAs, signOut } from "./current-session";
import {
  addMember,
  createUser,
  createJam,
  createOngoingJam,
  createFinishedJam,
  joinJam,
  createSubmission,
  grantJamRole,
  submissionFormData,
} from "./factories";

describe("createSubmissionAction authorization & gating", () => {
  it("rejects a signed-out user", async () => {
    const owner = await createUser();
    const jam = await createOngoingJam(owner.id);
    signOut();

    const res = await createSubmissionAction(jam.slug, submissionFormData());

    expect(res.error).toMatch(/signed in/i);
  });

  it("rejects submitting to a jam that is not ongoing", async () => {
    const owner = await createUser();
    // No dates => DRAFT status.
    const jam = await createJam(owner.id);
    const user = await createUser();
    await joinJam(jam.id, user.id);
    actingAs(user.id);

    const res = await createSubmissionAction(jam.slug, submissionFormData());

    expect(res.error).toMatch(/ongoing/i);
  });

  it("rejects a user who has not joined the jam", async () => {
    const owner = await createUser();
    const jam = await createOngoingJam(owner.id);
    const user = await createUser();
    actingAs(user.id);

    const res = await createSubmissionAction(jam.slug, submissionFormData());

    expect(res.error).toMatch(/join/i);
  });

  it("allows a participant and creates the submission with a leader", async () => {
    const owner = await createUser();
    const jam = await createOngoingJam(owner.id);
    const user = await createUser();
    await joinJam(jam.id, user.id);
    actingAs(user.id);

    const res = await createSubmissionAction(
      jam.slug,
      submissionFormData({ title: "Space Game" })
    );

    expect(res.success).toBe(true);
    const submission = await db.submission.findFirst({
      where: { jamId: jam.id },
      include: { members: true },
    });
    expect(submission?.title).toBe("Space Game");
    expect(submission?.members).toHaveLength(1);
    expect(submission?.members[0]).toMatchObject({
      userId: user.id,
      isLeader: true,
    });
  });

  it("rejects a second submission from the same user in one jam", async () => {
    const owner = await createUser();
    const jam = await createOngoingJam(owner.id);
    const user = await createUser();
    await joinJam(jam.id, user.id);
    actingAs(user.id);

    const first = await createSubmissionAction(jam.slug, submissionFormData());
    expect(first.success).toBe(true);

    const second = await createSubmissionAction(jam.slug, submissionFormData());
    expect(second.error).toMatch(/already have a submission/i);
  });
});

describe("updateSubmissionAction authorization", () => {
  it("rejects a non-member during the ongoing period", async () => {
    const owner = await createUser();
    const jam = await createOngoingJam(owner.id);
    const leader = await createUser();
    await joinJam(jam.id, leader.id);
    const submission = await createSubmission(jam.id, leader.id);

    const outsider = await createUser();
    actingAs(outsider.id);

    const res = await updateSubmissionAction(
      submission.id,
      submissionFormData({ title: "Hijacked" })
    );

    expect(res.error).toMatch(/permission/i);
  });

  it("allows a team member to edit and persists the change", async () => {
    const owner = await createUser();
    const jam = await createOngoingJam(owner.id);
    const leader = await createUser();
    await joinJam(jam.id, leader.id);
    const submission = await createSubmission(jam.id, leader.id, {
      title: "Old Title",
    });
    actingAs(leader.id);

    const res = await updateSubmissionAction(
      submission.id,
      submissionFormData({ title: "New Title" })
    );

    expect(res.success).toBe(true);
    const updated = await db.submission.findUnique({
      where: { id: submission.id },
    });
    expect(updated?.title).toBe("New Title");
  });

  it("rejects a plain member editing after the jam has finished", async () => {
    const owner = await createUser();
    const jam = await createFinishedJam(owner.id);
    const leader = await createUser();
    const submission = await createSubmission(jam.id, leader.id);
    actingAs(leader.id);

    const res = await updateSubmissionAction(
      submission.id,
      submissionFormData({ title: "Late Edit" })
    );

    expect(res.error).toMatch(/ongoing period/i);
  });

  it("allows a MODERATOR to edit after the jam has finished", async () => {
    const owner = await createUser();
    const jam = await createFinishedJam(owner.id);
    const leader = await createUser();
    const submission = await createSubmission(jam.id, leader.id, {
      title: "Old",
    });
    const mod = await createUser();
    await grantJamRole(jam.id, mod.id, "MODERATOR");
    actingAs(mod.id);

    const res = await updateSubmissionAction(
      submission.id,
      submissionFormData({ title: "Moderated" })
    );

    expect(res.success).toBe(true);
    const updated = await db.submission.findUnique({
      where: { id: submission.id },
    });
    expect(updated?.title).toBe("Moderated");
  });
});

describe("updateSubmissionAction custom fields", () => {
  async function setup() {
    const owner = await createUser();
    const jam = await createOngoingJam(owner.id);
    const leader = await createUser();
    await joinJam(jam.id, leader.id);
    const submission = await createSubmission(jam.id, leader.id, { title: "Original" });
    const engine = await db.customField.create({
      data: { jamId: jam.id, name: "Engine", required: true },
    });
    const notes = await db.customField.create({
      data: { jamId: jam.id, name: "Notes", required: false },
    });
    actingAs(leader.id);
    return { submission, engine, notes };
  }

  it("writes nothing when a custom field is invalid", async () => {
    const { submission, engine } = await setup();

    const res = await updateSubmissionAction(
      submission.id,
      submissionFormData({ title: "Changed", [`custom_${engine.id}`]: "" })
    );

    expect(res.error).toBe("Engine is required");
    const unchanged = await db.submission.findUnique({ where: { id: submission.id } });
    expect(unchanged?.title).toBe("Original");
  });

  it("clears an optional custom field left empty", async () => {
    const { submission, engine, notes } = await setup();
    await db.customFieldValue.create({
      data: { fieldId: notes.id, submissionId: submission.id, value: "old notes" },
    });

    const res = await updateSubmissionAction(
      submission.id,
      submissionFormData({ [`custom_${engine.id}`]: "Godot", [`custom_${notes.id}`]: "" })
    );

    expect(res.success).toBe(true);
    const values = await db.customFieldValue.findMany({
      where: { submissionId: submission.id },
      select: { fieldId: true, value: true },
    });
    expect(values).toEqual([{ fieldId: engine.id, value: "Godot" }]);
  });
});

describe("team management", () => {
  it("lets a contributor invite another participant, who then accepts", async () => {
    const owner = await createUser();
    const jam = await createOngoingJam(owner.id);
    const leader = await createUser();
    const contributor = await createUser();
    const newcomer = await createUser("newcomer");
    for (const u of [leader, contributor, newcomer]) await joinJam(jam.id, u.id);
    const submission = await createSubmission(jam.id, leader.id);
    await addMember(submission.id, contributor.id);
    actingAs(contributor.id);

    expect((await inviteContributorAction(submission.id, "newcomer")).success).toBe(true);
    const invite = await db.submissionInvite.findFirstOrThrow({ where: { submissionId: submission.id } });
    actingAs(newcomer.id);
    expect((await acceptInviteAction(invite.id)).success).toBe(true);

    expect(await db.submissionMember.count({ where: { submissionId: submission.id } })).toBe(3);
  });

  it("frees members of a deleted submission to join another team", async () => {
    const owner = await createUser();
    const jam = await createOngoingJam(owner.id);
    await grantJamRole(jam.id, owner.id, "ADMIN");
    const leader = await createUser();
    const former = await createUser("former");
    for (const u of [leader, former]) await joinJam(jam.id, u.id);
    const deleted = await createSubmission(jam.id, former.id);
    const submission = await createSubmission(jam.id, leader.id);

    actingAs(owner.id);
    expect((await deleteSubmissionAction(deleted.id)).success).toBe(true);
    actingAs(leader.id);
    const res = await inviteContributorAction(submission.id, "former");

    expect(res.success).toBe(true);
  });
});

describe("leaveSubmissionAction", () => {
  async function team(jamOf: (ownerId: string) => ReturnType<typeof createOngoingJam>) {
    const owner = await createUser();
    const jam = await jamOf(owner.id);
    const leader = await createUser();
    const member = await createUser();
    for (const u of [leader, member]) await joinJam(jam.id, u.id);
    const submission = await createSubmission(jam.id, leader.id);
    await addMember(submission.id, member.id);
    return { jam, leader, member, submission };
  }

  it("removes a non-leader member while ongoing and keeps them joined", async () => {
    const { jam, member, submission } = await team(createOngoingJam);
    actingAs(member.id);

    const res = await leaveSubmissionAction(submission.id);

    expect(res.success).toBe(true);
    expect(await db.submissionMember.count({ where: { submissionId: submission.id } })).toBe(1);
    expect(await db.jamParticipant.count({ where: { jamId: jam.id, userId: member.id } })).toBe(1);
  });

  it("refuses the leader with the hand-over reason", async () => {
    const { leader, submission } = await team(createOngoingJam);
    actingAs(leader.id);

    expect((await leaveSubmissionAction(submission.id)).error).toMatch(/transfer leadership/i);
    expect(await db.submissionMember.count({ where: { submissionId: submission.id } })).toBe(2);
  });

  it("refuses outside the ongoing period", async () => {
    const { member, submission } = await team(createFinishedJam);
    actingAs(member.id);

    expect((await leaveSubmissionAction(submission.id)).error).toMatch(/ongoing/i);
    expect(await db.submissionMember.count({ where: { submissionId: submission.id } })).toBe(2);
  });

  it("rejects signed-out users, non-members and unknown submissions", async () => {
    const { submission } = await team(createOngoingJam);
    const outsider = await createUser();

    signOut();
    expect((await leaveSubmissionAction(submission.id)).error).toMatch(/signed in/i);
    actingAs(outsider.id);
    expect((await leaveSubmissionAction(submission.id)).error).toMatch(/not on this team/i);
    expect((await leaveSubmissionAction("missing")).error).toMatch(/not found/i);
  });
});

describe("team action rate limits", () => {
  const actions: [string, () => Promise<{ error?: string }>][] = [
    ["remove", () => removeContributorAction("missing", "nobody")],
    ["transfer", () => transferLeaderAction("missing", "nobody")],
    ["leave", () => leaveSubmissionAction("missing")],
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

describe("deleteSubmissionAction by the team", () => {
  it("lets the leader delete while ongoing, but not a contributor", async () => {
    const owner = await createUser();
    const jam = await createOngoingJam(owner.id);
    const leader = await createUser();
    const contributor = await createUser();
    const submission = await createSubmission(jam.id, leader.id);
    await db.submissionMember.create({ data: { submissionId: submission.id, userId: contributor.id } });

    actingAs(contributor.id);
    expect((await deleteSubmissionAction(submission.id)).error).toMatch(/permission/i);

    actingAs(leader.id);
    expect((await deleteSubmissionAction(submission.id)).success).toBe(true);
    const row = await db.submission.findFirst({ where: { id: submission.id, deletedAt: { not: null } } });
    expect(row).not.toBeNull();
  });

  it("refuses the leader once submissions close", async () => {
    const owner = await createUser();
    const jam = await createFinishedJam(owner.id);
    const leader = await createUser();
    const submission = await createSubmission(jam.id, leader.id);

    actingAs(leader.id);
    expect((await deleteSubmissionAction(submission.id)).error).toMatch(/ongoing period/);
  });
});
