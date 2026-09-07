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
  rank: number | null;
  competing: boolean;
  criteriaScores: Record<string, { weighted: number; rank: number | null }>;
}

function allStored(): StoredResult[] {
  return mocks.jamResultCreate.mock.calls.map(
    (c) => (c[0] as { data: StoredResult }).data
  );
}

function storedResults(): StoredResult[] {
  return allStored()
    .filter((r) => r.competing)
    .sort((a, b) => (a.rank ?? 0) - (b.rank ?? 0));
}

// The scoring code queries submissions twice: competing (default) then the
// rank-excluded set (`where.competing === false`). Route the mock accordingly.
function mockSubmissions(competing: { id: string }[], notCompeting: { id: string }[] = []) {
  mocks.submissionFindMany.mockImplementation(
    async (args?: { where?: { competing?: boolean } }) =>
      args?.where?.competing === false ? notCompeting : competing
  );
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
    mockSubmissions([{ id: "sA" }, { id: "sB" }]);
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
    mockSubmissions([{ id: "sA" }, { id: "sB" }]);
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
    mockSubmissions([]);

    await computeJamResults("j1");

    expect(mocks.jamResultDeleteMany).toHaveBeenCalledWith({
      where: { jamId: "j1" },
    });
    expect(mocks.jamResultCreate).not.toHaveBeenCalled();
  });

  it("assigns each criterion its own ranking among competing submissions", async () => {
    mocks.criterionFindMany.mockResolvedValue([
      criterion({ id: "c1", name: "Gameplay", isPrimary: true }),
      criterion({ id: "c2", name: "Art", weight: 1 }),
    ]);
    mockSubmissions([{ id: "sA" }, { id: "sB" }]);
    mocks.ratingFindMany.mockResolvedValue([
      // Gameplay favors sA
      { submissionId: "sA", criterionId: "c1", score: 5 },
      { submissionId: "sB", criterionId: "c1", score: 1 },
      // Art favors sB
      { submissionId: "sA", criterionId: "c2", score: 1 },
      { submissionId: "sB", criterionId: "c2", score: 5 },
    ]);

    await computeJamResults("j1");

    const byId = Object.fromEntries(storedResults().map((r) => [r.submissionId, r]));
    expect(byId.sA.criteriaScores.c1.rank).toBe(1);
    expect(byId.sB.criteriaScores.c1.rank).toBe(2);
    expect(byId.sB.criteriaScores.c2.rank).toBe(1);
    expect(byId.sA.criteriaScores.c2.rank).toBe(2);
  });

  it("stores rated-but-excluded submissions separately, unranked", async () => {
    mocks.criterionFindMany.mockResolvedValue([criterion({})]);
    mockSubmissions([{ id: "sA" }], [{ id: "sX" }]);
    mocks.ratingFindMany.mockResolvedValue([
      { submissionId: "sA", criterionId: "c1", score: 4 },
      { submissionId: "sX", criterionId: "c1", score: 5 },
    ]);

    await computeJamResults("j1");

    const excluded = allStored().find((r) => r.submissionId === "sX");
    expect(excluded).toBeDefined();
    expect(excluded!.competing).toBe(false);
    expect(excluded!.rank).toBeNull();
    // Excluded entries are not part of any ranking.
    expect(excluded!.criteriaScores.c1.rank).toBeNull();
  });
});
