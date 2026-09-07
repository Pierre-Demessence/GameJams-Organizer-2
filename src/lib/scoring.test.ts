import { describe, it, expect, vi, beforeEach } from "vitest";

const mocks = vi.hoisted(() => ({
  criterionFindMany: vi.fn(),
  submissionFindMany: vi.fn(),
  ratingFindMany: vi.fn(),
  jamResultDeleteMany: vi.fn(),
  jamResultCreate: vi.fn((args: unknown) => args),
  transaction: vi.fn(async (ops: unknown) => ops),
}));

vi.mock("@/lib/db", () => ({
  db: {
    criterion: { findMany: mocks.criterionFindMany },
    submission: { findMany: mocks.submissionFindMany },
    rating: { findMany: mocks.ratingFindMany },
    jamResult: {
      deleteMany: mocks.jamResultDeleteMany,
      create: mocks.jamResultCreate,
    },
    $transaction: mocks.transaction,
  },
}));

import { computeJamResults } from "@/lib/scoring";

interface StoredResult {
  submissionId: string;
  rank: number;
}

function storedResults(): StoredResult[] {
  return mocks.jamResultCreate.mock.calls
    .map((c) => (c[0] as { data: StoredResult }).data)
    .sort((a, b) => a.rank - b.rank);
}

const criterion = (over: Partial<Record<string, unknown>>) => ({
  id: "c1",
  jamId: "j1",
  name: "Fun",
  description: null,
  weight: 1,
  source: "RATED",
  isPrimary: false,
  sortOrder: 0,
  ...over,
});

beforeEach(() => {
  vi.clearAllMocks();
});

describe("computeJamResults", () => {
  it("ranks higher-scored submissions first (lone criterion is primary)", async () => {
    mocks.criterionFindMany.mockResolvedValue([criterion({})]);
    mocks.submissionFindMany.mockResolvedValue([{ id: "sA" }, { id: "sB" }]);
    mocks.ratingFindMany.mockResolvedValue([
      { submissionId: "sA", criterionId: "c1", score: 5 },
      { submissionId: "sA", criterionId: "c1", score: 5 },
      { submissionId: "sA", criterionId: "c1", score: 5 },
      { submissionId: "sB", criterionId: "c1", score: 2 },
      { submissionId: "sB", criterionId: "c1", score: 2 },
    ]);

    await computeJamResults("j1");

    const ranks = storedResults();
    expect(ranks[0]).toMatchObject({ submissionId: "sA", rank: 1 });
    expect(ranks[1]).toMatchObject({ submissionId: "sB", rank: 2 });
  });

  it("uses the primary criterion for overall ranking, overriding weighted average", async () => {
    mocks.criterionFindMany.mockResolvedValue([
      criterion({ id: "c1", weight: 100, isPrimary: false }),
      criterion({ id: "c2", weight: 1, isPrimary: true, name: "Theme" }),
    ]);
    mocks.submissionFindMany.mockResolvedValue([{ id: "sA" }, { id: "sB" }]);
    mocks.ratingFindMany.mockResolvedValue([
      // c1 favors sB heavily (high weight)
      { submissionId: "sA", criterionId: "c1", score: 1 },
      { submissionId: "sA", criterionId: "c1", score: 1 },
      { submissionId: "sA", criterionId: "c1", score: 1 },
      { submissionId: "sB", criterionId: "c1", score: 5 },
      { submissionId: "sB", criterionId: "c1", score: 5 },
      { submissionId: "sB", criterionId: "c1", score: 5 },
      // c2 (primary) favors sA
      { submissionId: "sA", criterionId: "c2", score: 5 },
      { submissionId: "sA", criterionId: "c2", score: 5 },
      { submissionId: "sA", criterionId: "c2", score: 5 },
      { submissionId: "sB", criterionId: "c2", score: 1 },
      { submissionId: "sB", criterionId: "c2", score: 1 },
      { submissionId: "sB", criterionId: "c2", score: 1 },
    ]);

    await computeJamResults("j1");

    const ranks = storedResults();
    expect(ranks[0].submissionId).toBe("sA");
  });

  it("clears stale results and stores nothing when there are no submissions", async () => {
    mocks.criterionFindMany.mockResolvedValue([criterion({})]);
    mocks.submissionFindMany.mockResolvedValue([]);

    await computeJamResults("j1");

    expect(mocks.jamResultDeleteMany).toHaveBeenCalledWith({
      where: { jamId: "j1" },
    });
    expect(mocks.jamResultCreate).not.toHaveBeenCalled();
  });
});
