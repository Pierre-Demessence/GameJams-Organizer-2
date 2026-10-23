import { describe, it, expect } from "vitest";
import {
  canAcceptInvite,
  canCreateSubmission,
  canDeleteOwnSubmission,
  canEditSubmission,
  canFinalizeSubmission,
  canInviteContributor,
  canRemoveContributor,
  canTransferLeadership,
  canUnsubmit,
  isContributorWindowOpen,
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
  const window = { ranked: true, allowContributorsAfterClose: false };
  const invite = {
    ...window,
    isMember: true,
    teamSize: 1,
    pendingInvites: 0,
    maxTeamSize: null,
    invitee: { hasJoined: true, hasLiveSubmission: false, alreadyInvited: false },
  };
  const accept = {
    ...window,
    hasJoined: true,
    hasLiveSubmission: false,
    teamSize: 1,
    maxTeamSize: null,
  };
  const afterClose = { ranked: true, allowContributorsAfterClose: true };

  it("is open while ONGOING", () => {
    expect(openIn((phase) => ({ allowed: isContributorWindowOpen({ ...window, phase }) }))).toEqual([
      "ONGOING",
    ]);
  });

  it("extends through RATING when the ranked jam allows it", () => {
    expect(openIn((phase) => ({ allowed: isContributorWindowOpen({ ...afterClose, phase }) }))).toEqual([
      "ONGOING",
      "RATING",
    ]);
  });

  it("has no effect on non-ranked jams", () => {
    const unranked = { ranked: false, allowContributorsAfterClose: true };
    expect(openIn((phase) => ({ allowed: isContributorWindowOpen({ ...unranked, phase }) }))).toEqual([
      "ONGOING",
    ]);
  });

  describe("canInviteContributor", () => {
    it("lets any member invite while the window is open", () => {
      expect(openIn((phase) => canInviteContributor({ ...invite, phase }))).toEqual(["ONGOING"]);
      expect(
        openIn((phase) => canInviteContributor({ ...invite, ...afterClose, phase }))
      ).toEqual(["ONGOING", "RATING"]);
    });

    it("counts pending invites against the maximum team size", () => {
      const full = { ...invite, phase: "ONGOING" as const, maxTeamSize: 3, teamSize: 2 };
      expect(canInviteContributor({ ...full, pendingInvites: 0 }).allowed).toBe(true);
      expect(canInviteContributor({ ...full, pendingInvites: 1 }).allowed).toBe(false);
      expect(canInviteContributor({ ...full, teamSize: 3 }).allowed).toBe(false);
    });

    it("rejects non-members", () => {
      expect(canInviteContributor({ ...invite, phase: "ONGOING", isMember: false }).allowed).toBe(
        false
      );
    });

    it("needs an invitee who joined, has no live submission and is not yet invited", () => {
      const base = { ...invite, phase: "ONGOING" as const };
      const invitee = base.invitee;
      expect(canInviteContributor({ ...base, invitee: { ...invitee, hasJoined: false } }).allowed).toBe(false);
      expect(
        canInviteContributor({ ...base, invitee: { ...invitee, hasLiveSubmission: true } }).allowed
      ).toBe(false);
      expect(canInviteContributor({ ...base, invitee: { ...invitee, alreadyInvited: true } }).allowed).toBe(
        false
      );
    });
  });

  describe("canAcceptInvite", () => {
    it("is open while the window is open", () => {
      expect(openIn((phase) => canAcceptInvite({ ...accept, phase }))).toEqual(["ONGOING"]);
      expect(openIn((phase) => canAcceptInvite({ ...accept, ...afterClose, phase }))).toEqual([
        "ONGOING",
        "RATING",
      ]);
    });

    it("re-checks joined state and the single-submission rule", () => {
      const base = { ...accept, phase: "ONGOING" as const };
      expect(canAcceptInvite({ ...base, hasJoined: false }).allowed).toBe(false);
      expect(canAcceptInvite({ ...base, hasLiveSubmission: true }).allowed).toBe(false);
    });

    it("counts members only against the maximum team size", () => {
      const base = { ...accept, phase: "ONGOING" as const, maxTeamSize: 3 };
      expect(canAcceptInvite({ ...base, teamSize: 2 }).allowed).toBe(true);
      expect(canAcceptInvite({ ...base, teamSize: 3 }).allowed).toBe(false);
    });
  });

  describe("canRemoveContributor", () => {
    const team = { ...window, isMember: true };

    it("never removes after close, even when additions stay open", () => {
      const after = { ...team, ...afterClose, targetIsLeader: false };
      expect(openIn((phase) => canRemoveContributor({ ...after, phase }))).toEqual(["ONGOING"]);
    });

    it("never removes the leader", () => {
      expect(
        canRemoveContributor({ ...team, phase: "ONGOING", targetIsLeader: true }).allowed
      ).toBe(false);
    });
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

describe("canDeleteOwnSubmission", () => {
  it("lets the leader delete while the jam is ongoing", () => {
    expect(canDeleteOwnSubmission({ phase: "ONGOING", isLeader: true }).allowed).toBe(true);
  });

  it("refuses contributors and closed jams", () => {
    expect(canDeleteOwnSubmission({ phase: "ONGOING", isLeader: false }).allowed).toBe(false);
    expect(canDeleteOwnSubmission({ phase: "RATING", isLeader: true }).allowed).toBe(false);
  });
});
