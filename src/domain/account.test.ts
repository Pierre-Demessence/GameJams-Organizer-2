import { describe, it, expect } from "vitest";
import {
  planAccountDeletion,
  type AccountDeletionInput,
  type AccountJamRole,
  type AccountMembership,
} from "@/domain/account";
import type { JamPhase } from "@/domain/jam-phase";

const phases: JamPhase[] = ["DRAFT", "UPCOMING", "ONGOING", "RATING", "FINISHED"];
const beforeRating: JamPhase[] = ["DRAFT", "UPCOMING", "ONGOING"];
const frozen: JamPhase[] = ["RATING", "FINISHED"];
const PUBLISHED = new Date("2026-01-01T00:00:00Z");

const membership = (overrides: Partial<AccountMembership> = {}): AccountMembership => ({
  submissionId: "s1",
  title: "Pixel Quest",
  phase: "ONGOING",
  isLeader: false,
  memberCount: 3,
  submissionDeletedAt: null,
  ...overrides,
});

const jamRole = (overrides: Partial<AccountJamRole> = {}): AccountJamRole => ({
  jamId: "j1",
  slug: "spring-jam",
  name: "Spring Jam",
  role: "ADMIN",
  phase: "ONGOING",
  publishedAt: PUBLISHED,
  adminCount: 1,
  ...overrides,
});

const input = (overrides: Partial<AccountDeletionInput> = {}): AccountDeletionInput => ({
  userId: "u1",
  isStaff: false,
  memberships: [],
  jamRoles: [],
  participations: [],
  ...overrides,
});

function blockersOf(i: AccountDeletionInput) {
  const plan = planAccountDeletion(i);
  if (plan.allowed) throw new Error("expected a refusal");
  return plan.blockers;
}

function opsOf(i: AccountDeletionInput) {
  const plan = planAccountDeletion(i);
  if (!plan.allowed) throw new Error(`expected an allowed plan, got ${JSON.stringify(plan.blockers)}`);
  return plan;
}

describe("planAccountDeletion: an account with nothing attached", () => {
  it("is allowed and changes nothing", () => {
    const { ops, preview } = opsOf(input());
    expect(ops).toEqual({
      removeMembershipSubmissionIds: [],
      softDeleteSubmissionIds: [],
      softDeleteJamIds: [],
      removeParticipationJamIds: [],
    });
    expect(preview.roles).toBe(0);
    expect(preview.keptMemberships).toBe(0);
  });
});

describe("planAccountDeletion: staff", () => {
  it("refuses a staff member", () => {
    expect(blockersOf(input({ isStaff: true }))).toEqual([
      {
        kind: "STAFF",
        id: "u1",
        name: "Staff role",
        reason: "Ask another admin to remove your staff role first",
      },
    ]);
  });

  it("reports the staff blocker alongside the others", () => {
    const kinds = blockersOf(
      input({
        isStaff: true,
        memberships: [membership({ isLeader: true })],
        jamRoles: [jamRole()],
      })
    ).map((b) => b.kind);
    expect(kinds).toEqual(["STAFF", "LED_TEAM", "SOLE_ADMIN"]);
  });
});

describe("planAccountDeletion: team memberships", () => {
  it("removes a non-leader membership in every phase before RATING", () => {
    for (const phase of beforeRating) {
      const { ops, preview } = opsOf(input({ memberships: [membership({ phase })] }));
      expect(ops.removeMembershipSubmissionIds, phase).toEqual(["s1"]);
      expect(preview.leavingTeams).toEqual([{ id: "s1", title: "Pixel Quest" }]);
    }
  });

  it("refuses a leader with other members in every phase before RATING, naming the submission", () => {
    for (const phase of beforeRating) {
      const [blocker] = blockersOf(input({ memberships: [membership({ phase, isLeader: true })] }));
      expect(blocker, phase).toEqual({
        kind: "LED_TEAM",
        id: "s1",
        name: "Pixel Quest",
        reason: "Transfer leadership of Pixel Quest first",
      });
    }
  });

  it("soft-deletes a submission the user leads alone", () => {
    for (const phase of beforeRating) {
      const { ops, preview } = opsOf(
        input({ memberships: [membership({ phase, isLeader: true, memberCount: 1 })] })
      );
      expect(ops.softDeleteSubmissionIds, phase).toEqual(["s1"]);
      expect(ops.removeMembershipSubmissionIds).toEqual([]);
      expect(preview.deletedSubmissions).toEqual([{ id: "s1", title: "Pixel Quest" }]);
    }
  });

  it("keeps memberships in RATING and FINISHED jams, leader or not", () => {
    for (const phase of frozen) {
      for (const isLeader of [true, false]) {
        const { ops, preview } = opsOf(input({ memberships: [membership({ phase, isLeader })] }));
        expect(ops.removeMembershipSubmissionIds, `${phase} leader=${isLeader}`).toEqual([]);
        expect(ops.softDeleteSubmissionIds).toEqual([]);
        expect(preview.keptMemberships).toBe(1);
      }
    }
  });

  it("ignores a submission that is already deleted", () => {
    const deleted = membership({ isLeader: true, submissionDeletedAt: new Date() });
    const { ops, preview } = opsOf(input({ memberships: [deleted] }));
    expect(ops.removeMembershipSubmissionIds).toEqual([]);
    expect(ops.softDeleteSubmissionIds).toEqual([]);
    expect(preview.keptMemberships).toBe(0);
  });

  it("lists every blocking team, not just the first", () => {
    const blockers = blockersOf(
      input({
        memberships: [
          membership({ submissionId: "a", title: "A", isLeader: true }),
          membership({ submissionId: "b", title: "B", isLeader: true }),
        ],
      })
    );
    expect(blockers.map((b) => b.id)).toEqual(["a", "b"]);
  });

  it("refuses the whole deletion if one team blocks, even when another could be removed", () => {
    const plan = planAccountDeletion(
      input({
        memberships: [
          membership({ submissionId: "a", isLeader: true }),
          membership({ submissionId: "b", isLeader: false }),
        ],
      })
    );
    expect(plan.allowed).toBe(false);
  });
});

describe("planAccountDeletion: jam roles", () => {
  it("refuses the only Jam Admin of a published jam that is not finished", () => {
    for (const phase of ["UPCOMING", "ONGOING", "RATING"] as const) {
      const [blocker] = blockersOf(input({ jamRoles: [jamRole({ phase })] }));
      expect(blocker, phase).toEqual({
        kind: "SOLE_ADMIN",
        id: "j1",
        name: "Spring Jam",
        slug: "spring-jam",
        reason: "Add another Jam Admin to Spring Jam first, or wait until it has finished",
      });
    }
  });

  it("lets the only Jam Admin of a finished jam go; the jam stays", () => {
    const { ops, preview } = opsOf(input({ jamRoles: [jamRole({ phase: "FINISHED" })] }));
    expect(ops.softDeleteJamIds).toEqual([]);
    expect(preview.roles).toBe(1);
  });

  it("soft-deletes a draft jam where the user is the only Jam Admin", () => {
    const draft = jamRole({ phase: "DRAFT", publishedAt: null });
    const { ops, preview } = opsOf(input({ jamRoles: [draft] }));
    expect(ops.softDeleteJamIds).toEqual(["j1"]);
    expect(preview.deletedJams).toEqual([{ id: "j1", name: "Spring Jam" }]);
  });

  it("keeps a draft jam that has another Jam Admin", () => {
    const draft = jamRole({ phase: "DRAFT", publishedAt: null, adminCount: 2 });
    expect(opsOf(input({ jamRoles: [draft] })).ops.softDeleteJamIds).toEqual([]);
  });

  it("lets a user go when another Jam Admin covers a live jam", () => {
    for (const phase of phases) {
      const covered = jamRole({ phase, adminCount: 2 });
      expect(planAccountDeletion(input({ jamRoles: [covered] })).allowed, phase).toBe(true);
    }
  });

  it("only blocks on the ADMIN role; other roles are just removed", () => {
    for (const role of ["MODERATOR", "JUDGE", "HOST"] as const) {
      const { ops, preview } = opsOf(input({ jamRoles: [jamRole({ role, adminCount: 0 })] }));
      expect(ops.softDeleteJamIds, role).toEqual([]);
      expect(preview.roles).toBe(1);
    }
  });

  it("does not soft-delete a draft jam on a non-admin role", () => {
    const judge = jamRole({ role: "JUDGE", phase: "DRAFT", publishedAt: null, adminCount: 1 });
    expect(opsOf(input({ jamRoles: [judge] })).ops.softDeleteJamIds).toEqual([]);
  });
});

describe("planAccountDeletion: jam participation", () => {
  it("removes participation in phases before RATING", () => {
    for (const phase of beforeRating) {
      const { ops, preview } = opsOf(input({ participations: [{ jamId: "j9", phase }] }));
      expect(ops.removeParticipationJamIds, phase).toEqual(["j9"]);
      expect(preview.leavingJams).toBe(1);
    }
  });

  it("keeps participation in RATING and FINISHED jams", () => {
    for (const phase of frozen) {
      const { ops, preview } = opsOf(input({ participations: [{ jamId: "j9", phase }] }));
      expect(ops.removeParticipationJamIds, phase).toEqual([]);
      expect(preview.leavingJams).toBe(0);
    }
  });
});
