import { describe, it, expect } from "vitest";
import {
  canAddContributor,
  canCreateSubmission,
  canEditSubmission,
  canFinalizeSubmission,
  canRemoveContributor,
  canTransferLeadership,
  canUnsubmit,
} from "@/domain/submission";
import type { JamPhase } from "@/domain/jam-phase";

const phases: JamPhase[] = ["DRAFT", "UPCOMING", "ONGOING", "RATING", "FINISHED"];
const openIn = (check: (phase: JamPhase) => { allowed: boolean }) =>
  phases.filter((phase) => check(phase).allowed);

describe("canCreateSubmission", () => {
  it("is open to joined users without a submission while ONGOING", () => {
    expect(
      openIn((phase) => canCreateSubmission({ phase, hasJoined: true, hasSubmission: false }))
    ).toEqual(["ONGOING"]);
  });

  it("requires joining first and allows one submission per jam", () => {
    const base = { phase: "ONGOING" as const, hasJoined: true, hasSubmission: false };
    expect(canCreateSubmission({ ...base, hasJoined: false }).allowed).toBe(false);
    expect(canCreateSubmission({ ...base, hasSubmission: true }).allowed).toBe(false);
  });
});

describe("canEditSubmission", () => {
  it("lets members edit while ONGOING only", () => {
    expect(
      openIn((phase) => canEditSubmission({ phase, isMember: true, canEditAny: false }))
    ).toEqual(["ONGOING"]);
  });

  it("lets organizers with edit_submission edit in any phase", () => {
    expect(
      openIn((phase) => canEditSubmission({ phase, isMember: false, canEditAny: true }))
    ).toEqual(phases);
  });

  it("rejects outsiders", () => {
    expect(
      canEditSubmission({ phase: "ONGOING", isMember: false, canEditAny: false }).allowed
    ).toBe(false);
  });
});

describe("canFinalizeSubmission", () => {
  const ready = {
    phase: "ONGOING" as const,
    hasItchUrl: true,
    verified: true,
    missingRequiredFields: [],
  };

  it("allows a verified, complete submission while ONGOING", () => {
    expect(canFinalizeSubmission(ready).allowed).toBe(true);
  });

  it("closes at the deadline", () => {
    expect(canFinalizeSubmission({ ...ready, phase: "RATING" }).allowed).toBe(false);
  });

  it("requires a verified itch.io link", () => {
    expect(canFinalizeSubmission({ ...ready, hasItchUrl: false }).allowed).toBe(false);
    expect(canFinalizeSubmission({ ...ready, verified: false }).allowed).toBe(false);
  });

  it("names the missing required fields", () => {
    expect(
      canFinalizeSubmission({ ...ready, missingRequiredFields: ["Engine", "Repo"] })
    ).toEqual({
      allowed: false,
      reason: "Fill in all required fields before submitting: Engine, Repo",
    });
  });
});

describe("canUnsubmit", () => {
  it("is open while ONGOING only", () => {
    expect(openIn((phase) => canUnsubmit({ phase }))).toEqual(["ONGOING"]);
  });
});

describe("contributor change window", () => {
  const team = {
    ranked: true,
    allowContributorsAfterClose: false,
    isMember: true,
    teamSize: 1,
    maxTeamSize: null,
  };

  it("lets any member add contributors while ONGOING", () => {
    expect(openIn((phase) => canAddContributor({ ...team, phase }))).toEqual(["ONGOING"]);
  });

  it("extends additions through RATING when the ranked jam allows it", () => {
    const after = { ...team, allowContributorsAfterClose: true };
    expect(openIn((phase) => canAddContributor({ ...after, phase }))).toEqual([
      "ONGOING",
      "RATING",
    ]);
  });

  it("has no effect on non-ranked jams", () => {
    const unranked = { ...team, ranked: false, allowContributorsAfterClose: true };
    expect(openIn((phase) => canAddContributor({ ...unranked, phase }))).toEqual(["ONGOING"]);
  });

  it("respects the maximum team size", () => {
    const full = { ...team, phase: "ONGOING" as const, teamSize: 3, maxTeamSize: 3 };
    expect(canAddContributor(full).allowed).toBe(false);
    expect(canAddContributor({ ...full, teamSize: 2 }).allowed).toBe(true);
  });

  it("rejects non-members", () => {
    expect(canAddContributor({ ...team, phase: "ONGOING", isMember: false }).allowed).toBe(
      false
    );
  });

  it("never removes after close, even when additions stay open", () => {
    const after = { ...team, allowContributorsAfterClose: true, targetIsLeader: false };
    expect(openIn((phase) => canRemoveContributor({ ...after, phase }))).toEqual(["ONGOING"]);
  });

  it("never removes the leader", () => {
    expect(
      canRemoveContributor({ ...team, phase: "ONGOING", targetIsLeader: true }).allowed
    ).toBe(false);
  });
});

describe("canTransferLeadership", () => {
  it("lets the leader hand over to a member", () => {
    expect(canTransferLeadership({ isLeader: true, targetIsMember: true }).allowed).toBe(true);
  });

  it("rejects contributors and non-member targets", () => {
    expect(canTransferLeadership({ isLeader: false, targetIsMember: true }).allowed).toBe(
      false
    );
    expect(canTransferLeadership({ isLeader: true, targetIsMember: false }).allowed).toBe(
      false
    );
  });
});
