import { describe, it, expect } from "vitest";
import { teamPanelState } from "@/lib/team-panel";

const base = { phase: "ONGOING" as const, ranked: true, allowContributorsAfterClose: false, isMember: true };

describe("teamPanelState", () => {
  it("lets a contributor invite, remove and leave while ONGOING", () => {
    expect(teamPanelState({ ...base, isLeader: false })).toEqual({
      canInvite: true,
      canRemove: true,
      canLeave: true,
      leaveHint: null,
    });
  });

  it("tells the leader to hand over instead of offering Leave", () => {
    const state = teamPanelState({ ...base, isLeader: true });
    expect(state.canLeave).toBe(false);
    expect(state.leaveHint).toMatch(/transfer leadership/i);
  });

  it("keeps only invites open during RATING when late contributors are allowed", () => {
    const rating = { ...base, phase: "RATING" as const, allowContributorsAfterClose: true, isLeader: false };
    expect(teamPanelState(rating)).toEqual({
      canInvite: true,
      canRemove: false,
      canLeave: false,
      leaveHint: null,
    });
  });

  it("shows no leader hint once the roster is frozen", () => {
    const frozen = teamPanelState({ ...base, phase: "FINISHED", isLeader: true });
    expect(frozen).toEqual({ canInvite: false, canRemove: false, canLeave: false, leaveHint: null });
  });

  it("offers nothing to non-members", () => {
    const outsider = teamPanelState({ ...base, isMember: false, isLeader: false });
    expect(outsider).toEqual({ canInvite: false, canRemove: false, canLeave: false, leaveHint: null });
  });
});
