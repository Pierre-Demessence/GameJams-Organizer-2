import { describe, it, expect } from "vitest";
import { canJoin, canLeaveJam, canLeaveSubmission } from "@/domain/participation";
import type { JamPhase } from "@/domain/jam-phase";

const phases: JamPhase[] = ["DRAFT", "UPCOMING", "ONGOING", "RATING", "FINISHED"];

describe("canJoin", () => {
  it("is open while UPCOMING or ONGOING only", () => {
    const open = phases.filter((phase) => canJoin({ phase, hasJoined: false }).allowed);
    expect(open).toEqual(["UPCOMING", "ONGOING"]);
  });

  it("rejects joining twice", () => {
    expect(canJoin({ phase: "ONGOING", hasJoined: true })).toEqual({
      allowed: false,
      reason: "You have already joined this jam",
    });
  });
});

describe("canLeaveJam", () => {
  it("lets a joined user without a submission leave", () => {
    expect(canLeaveJam({ hasJoined: true, isParticipant: false }).allowed).toBe(true);
  });

  it("requires leaving the submission first", () => {
    expect(canLeaveJam({ hasJoined: true, isParticipant: true }).allowed).toBe(false);
  });

  it("rejects users who never joined", () => {
    expect(canLeaveJam({ hasJoined: false, isParticipant: false }).allowed).toBe(false);
  });
});

describe("canLeaveSubmission", () => {
  it("is open to contributors while ONGOING only", () => {
    const open = phases.filter(
      (phase) => canLeaveSubmission({ phase, isLeader: false }).allowed
    );
    expect(open).toEqual(["ONGOING"]);
  });

  it("makes the leader hand over first", () => {
    expect(canLeaveSubmission({ phase: "ONGOING", isLeader: true }).allowed).toBe(false);
  });
});
