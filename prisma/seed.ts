import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { hashSync } from "bcryptjs";
import "dotenv/config";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

function days(n: number) {
  return n * 24 * 60 * 60 * 1000;
}

async function recreateCriteria(jamId: string) {
  await prisma.criterion.deleteMany({ where: { jamId } });

  await prisma.criterion.createMany({
    data: [
      { jamId, name: "Fun", description: "How fun is the game?", weight: 1, sortOrder: 0 },
      { jamId, name: "Creativity", description: "How creative is the concept?", weight: 1, sortOrder: 1 },
      { jamId, name: "Theme", description: "How well does it fit the theme?", weight: 0.5, sortOrder: 2 },
    ],
  });

  return prisma.criterion.findMany({
    where: { jamId },
    orderBy: { sortOrder: "asc" },
  });
}

async function createSeedSubmissions(
  jamId: string,
  createdAt: Date,
  entries: Array<{
    key: string;
    leaderId: string;
    title: string;
    description: string;
    coverUrl: string;
    linkWeb: string;
    screenshots: string[];
    videoUrl: string;
  }>
) {
  await prisma.submission.deleteMany({ where: { jamId } });

  const submissions = await Promise.all(
    entries.map(async (entry) => {
      const submission = await prisma.submission.create({
        data: {
          jamId,
          title: entry.title,
          description: entry.description,
          coverUrl: entry.coverUrl,
          itchUrl: entry.linkWeb,
          supportedPlatforms: ["WEB"],
          status: "SUBMITTED",
          verified: true,
          verifiedAt: createdAt,
          screenshots: entry.screenshots,
          videoUrl: entry.videoUrl,
          createdAt,
          members: {
            create: {
              userId: entry.leaderId,
              isLeader: true,
            },
          },
        },
      });

      return [entry.key, submission] as const;
    })
  );

  return Object.fromEntries(submissions);
}

async function createRatings(
  criteria: Array<{ id: string }>,
  submissions: Record<string, { id: string }>,
  entries: Array<{
    raterId: string;
    targetKey: string;
    scores: [number, number, number];
  }>
) {
  await prisma.$transaction(
    entries.flatMap((entry) =>
      criteria.map((criterion, index) =>
        prisma.rating.upsert({
          where: {
            submissionId_criterionId_userId: {
              submissionId: submissions[entry.targetKey].id,
              criterionId: criterion.id,
              userId: entry.raterId,
            },
          },
          update: { score: entry.scores[index] },
          create: {
            submissionId: submissions[entry.targetKey].id,
            criterionId: criterion.id,
            userId: entry.raterId,
            score: entry.scores[index],
          },
        })
      )
    )
  );
}

async function main() {
  const password = hashSync("password123", 12);

  const alice = await prisma.user.upsert({
    where: { email: "alice@example.com" },
    update: {},
    create: {
      email: "alice@example.com",
      username: "alice",
      displayName: "Alice",
      passwordHash: password,
    },
  });

  const bob = await prisma.user.upsert({
    where: { email: "bob@example.com" },
    update: {},
    create: {
      email: "bob@example.com",
      username: "bob",
      displayName: "Bob",
      passwordHash: password,
    },
  });

  const charlie = await prisma.user.upsert({
    where: { email: "charlie@example.com" },
    update: {},
    create: {
      email: "charlie@example.com",
      username: "charlie",
      displayName: "Charlie",
      passwordHash: password,
    },
  });

  // Grant the seeded Site Admin. Defaults to Alice in dev; override with STAFF_ADMIN_EMAIL.
  const staffAdminEmail = process.env.STAFF_ADMIN_EMAIL ?? "alice@example.com";
  const staffAdmin = await prisma.user.findUnique({
    where: { email: staffAdminEmail },
  });
  if (staffAdmin) {
    await prisma.staffRole.upsert({
      where: { userId_role: { userId: staffAdmin.id, role: "SITE_ADMIN" } },
      update: {},
      create: { userId: staffAdmin.id, role: "SITE_ADMIN" },
    });
  }

  // Upserts refresh each jam's schedule, so re-seeding re-anchors every phase to now.
  const now = Date.now();

  // DRAFT: no dates, unlisted (default visibility)
  const draftJam = await prisma.jam.upsert({
    where: { slug: "draft-jam" },
    update: {},
    create: {
      name: "Draft Jam (WIP)",
      slug: "draft-jam",
      shortDesc: "This jam is still being set up.",
      fullDesc: "# Draft Jam\n\nNothing to see here yet — the organizer is still planning things.",
      tags: ["draft"],
      ranked: false,
      visibility: "UNLISTED",
      createdById: alice.id,
    },
  });

  // UPCOMING: starts in 7 days, public
  const upcomingJam = await prisma.jam.upsert({
    where: { slug: "upcoming-jam" },
    update: {
      publishedAt: new Date(now - days(45)),
      startDate: new Date(now + days(7)),
      endDate: new Date(now + days(14)),
      ratingEnd: new Date(now + days(21)),
    },
    create: {
      name: "Upcoming Jam",
      slug: "upcoming-jam",
      shortDesc: "Get ready — this jam starts soon!",
      fullDesc: "# Upcoming Jam\n\nPrepare your tools and team. The theme will be revealed at the start.",
      tags: ["upcoming", "beginner-friendly"],
      ranked: true,
      visibility: "PUBLIC",
      publishedAt: new Date(now - days(45)),
      startDate: new Date(now + days(7)),
      endDate: new Date(now + days(14)),
      ratingEnd: new Date(now + days(21)),
      theme: "Metamorphosis",
      revealThemeOnStart: true,
      ratingEligibility: "SUBMITTERS_AND_CONTRIBUTORS",
      createdById: alice.id,
    },
  });

  // ONGOING: started 2 days ago, ends in 5 days
  const ongoingDesc = [
    "# Tiny Worlds — Ongoing Jam",
    "",
    "Welcome, jammers! **Submissions are open** and the theme is *Tiny Worlds*.",
    "You have five days to build something small, strange, and wonderful.",
    "",
    "## Schedule",
    "",
    "| Phase       | Opens |      Closes |",
    "| :---------- | :---: | ---------: |",
    "| Submissions | Day 0 |      Day 7 |",
    "| Rating      | Day 7 |     Day 14 |",
    "| Results     |   —   |     Day 14 |",
    "",
    "## Rules",
    "",
    "1. Work solo — no teams for this one.",
    "2. All assets must be made **during** the jam.",
    "3. Keep it family-friendly.",
    "",
    "## Resources",
    "",
    "- [Godot Engine](https://godotengine.org)",
    "- [OpenGameArt](https://opengameart.org)",
    "- Free fonts, SFX, and music are on the [wiki](https://example.com/wiki)",
    "",
    "> **Tip:** scope small. A polished tiny world beats an unfinished galaxy.",
    "",
    "## Submitting",
    "",
    "Build a web or downloadable release, then paste the link below.<br/>",
    "Include a short `README` describing the controls:",
    "",
    "```text",
    "WASD  — move",
    "Space — jump",
    "Esc   — pause",
    "```",
    "",
    "---",
    "",
    "Good luck, and have fun! 🌱",
  ].join("\n");
  const ongoingJam = await prisma.jam.upsert({
    where: { slug: "ongoing-jam" },
    update: {
      publishedAt: new Date(now - days(45)),
      startDate: new Date(now - days(2)),
      endDate: new Date(now + days(5)),
      ratingEnd: new Date(now + days(12)),
    },
    create: {
      name: "Ongoing Jam",
      slug: "ongoing-jam",
      shortDesc: "This jam is happening right now!",
      fullDesc: ongoingDesc,
      tags: ["active", "solo"],
      ranked: true,
      visibility: "PUBLIC",
      publishedAt: new Date(now - days(45)),
      startDate: new Date(now - days(2)),
      endDate: new Date(now + days(5)),
      ratingEnd: new Date(now + days(12)),
      theme: "Tiny Worlds",
      revealThemeOnStart: false,
      ratingEligibility: "SUBMITTERS_AND_CONTRIBUTORS",
      createdById: bob.id,
    },
  });

  // RATING: submissions closed, rating in progress
  const ratingJam = await prisma.jam.upsert({
    where: { slug: "rating-jam" },
    update: {
      publishedAt: new Date(now - days(45)),
      startDate: new Date(now - days(14)),
      endDate: new Date(now - days(3)),
      ratingEnd: new Date(now + days(4)),
    },
    create: {
      name: "Rating Jam",
      slug: "rating-jam",
      shortDesc: "Submissions are closed — time to rate!",
      fullDesc: "# Rating Jam\n\nPlay and rate the entries before the rating period ends.",
      tags: ["rating", "competitive"],
      ranked: true,
      visibility: "PUBLIC",
      publishedAt: new Date(now - days(45)),
      startDate: new Date(now - days(14)),
      endDate: new Date(now - days(3)),
      ratingEnd: new Date(now + days(4)),
      theme: "One Button",
      revealThemeOnStart: false,
      ratingEligibility: "EVERYONE",
      createdById: alice.id,
    },
  });

  // FINISHED (ranked): rating period over
  const finishedRankedJam = await prisma.jam.upsert({
    where: { slug: "finished-ranked-jam" },
    update: {
      publishedAt: new Date(now - days(45)),
      startDate: new Date(now - days(30)),
      endDate: new Date(now - days(20)),
      ratingEnd: new Date(now - days(10)),
    },
    create: {
      name: "Finished Ranked Jam",
      slug: "finished-ranked-jam",
      shortDesc: "This jam is over — check out the results!",
      fullDesc: "# Finished Ranked Jam\n\nThe results are in. See who won!",
      tags: ["finished", "competitive"],
      ranked: true,
      visibility: "PUBLIC",
      publishedAt: new Date(now - days(45)),
      startDate: new Date(now - days(30)),
      endDate: new Date(now - days(20)),
      ratingEnd: new Date(now - days(10)),
      theme: "Loops",
      revealThemeOnStart: false,
      ratingEligibility: "SUBMITTERS_ONLY",
      createdById: charlie.id,
    },
  });

  // FINISHED (non-ranked): no rating period at all
  const finishedUnrankedJam = await prisma.jam.upsert({
    where: { slug: "finished-unranked-jam" },
    update: {
      publishedAt: new Date(now - days(45)),
      startDate: new Date(now - days(21)),
      endDate: new Date(now - days(14)),
    },
    create: {
      name: "Finished Casual Jam",
      slug: "finished-unranked-jam",
      shortDesc: "A casual jam that has ended.",
      fullDesc: "# Finished Casual Jam\n\nNo rankings — just fun and creativity.",
      tags: ["finished", "casual"],
      ranked: false,
      visibility: "PUBLIC",
      publishedAt: new Date(now - days(45)),
      startDate: new Date(now - days(21)),
      endDate: new Date(now - days(14)),
      createdById: bob.id,
    },
  });

  // UPCOMING + UNLISTED: private jam accessible only via link
  const unlistedJam = await prisma.jam.upsert({
    where: { slug: "private-friends-jam" },
    update: {
      publishedAt: new Date(now - days(45)),
      startDate: new Date(now + days(3)),
      endDate: new Date(now + days(10)),
    },
    create: {
      name: "Private Friends Jam",
      slug: "private-friends-jam",
      shortDesc: "An invite-only jam for friends.",
      fullDesc: "# Private Friends Jam\n\nThis jam is unlisted — share the link with your group.",
      tags: ["private"],
      ranked: false,
      visibility: "UNLISTED",
      publishedAt: new Date(now - days(45)),
      startDate: new Date(now + days(3)),
      endDate: new Date(now + days(10)),
      createdById: alice.id,
    },
  });

  const allJams = [
    { jam: draftJam, owner: alice },
    { jam: upcomingJam, owner: alice },
    { jam: ongoingJam, owner: bob },
    { jam: ratingJam, owner: alice },
    { jam: finishedRankedJam, owner: charlie },
    { jam: finishedUnrankedJam, owner: bob },
    { jam: unlistedJam, owner: alice },
  ];

  for (const { jam, owner } of allJams) {
    await prisma.jamRole.upsert({
      where: {
        jamId_userId_role: { jamId: jam.id, userId: owner.id, role: "ADMIN" },
      },
      update: {},
      create: { jamId: jam.id, userId: owner.id, role: "ADMIN" },
    });
  }

  const rankedJams = [upcomingJam, ongoingJam, ratingJam, finishedRankedJam];
  const criteriaByJamId = new Map<string, Awaited<ReturnType<typeof recreateCriteria>>>();
  for (const jam of rankedJams) {
    criteriaByJamId.set(jam.id, await recreateCriteria(jam.id));
  }

  for (const jam of [ongoingJam, ratingJam, finishedRankedJam, finishedUnrankedJam]) {
    for (const user of [alice, bob, charlie]) {
      await prisma.jamParticipant.upsert({
        where: { jamId_userId: { jamId: jam.id, userId: user.id } },
        update: {},
        create: { jamId: jam.id, userId: user.id },
      });
    }
  }

  const ongoingSubmissions = await createSeedSubmissions(ongoingJam.id, new Date(now - days(1)), [
    {
      key: "clockwork-cavern",
      leaderId: alice.id,
      title: "Clockwork Cavern",
      description: "A tiny spelunking platformer about winding mechanisms and hidden rooms.",
      coverUrl: "https://example.com/seeds/ongoing/clockwork-cavern/cover.png",
      linkWeb: "https://example.com/seeds/ongoing/clockwork-cavern",
      screenshots: [
        "https://example.com/seeds/ongoing/clockwork-cavern/screen-1.png",
        "https://example.com/seeds/ongoing/clockwork-cavern/screen-2.png",
      ],
      videoUrl: "https://example.com/seeds/ongoing/clockwork-cavern/trailer.mp4",
    },
    {
      key: "pocket-planet",
      leaderId: bob.id,
      title: "Pocket Planet",
      description: "A toy-sized world builder where every tile affects the ecosystem.",
      coverUrl: "https://example.com/seeds/ongoing/pocket-planet/cover.png",
      linkWeb: "https://example.com/seeds/ongoing/pocket-planet",
      screenshots: [
        "https://example.com/seeds/ongoing/pocket-planet/screen-1.png",
        "https://example.com/seeds/ongoing/pocket-planet/screen-2.png",
      ],
      videoUrl: "https://example.com/seeds/ongoing/pocket-planet/trailer.mp4",
    },
    {
      key: "whisker-wizard",
      leaderId: charlie.id,
      title: "Whisker Wizard",
      description: "A fast arcade roguelite starring a cat mage who folds space with spells.",
      coverUrl: "https://example.com/seeds/ongoing/whisker-wizard/cover.png",
      linkWeb: "https://example.com/seeds/ongoing/whisker-wizard",
      screenshots: [
        "https://example.com/seeds/ongoing/whisker-wizard/screen-1.png",
        "https://example.com/seeds/ongoing/whisker-wizard/screen-2.png",
      ],
      videoUrl: "https://example.com/seeds/ongoing/whisker-wizard/trailer.mp4",
    },
  ]);

  const ratingSubmissions = await createSeedSubmissions(ratingJam.id, new Date(now - days(8)), [
    {
      key: "echo-engine",
      leaderId: alice.id,
      title: "Echo Engine",
      description: "Route sound waves through abandoned machinery to reactivate a silent city.",
      coverUrl: "https://example.com/seeds/rating/echo-engine/cover.png",
      linkWeb: "https://example.com/seeds/rating/echo-engine",
      screenshots: [
        "https://example.com/seeds/rating/echo-engine/screen-1.png",
        "https://example.com/seeds/rating/echo-engine/screen-2.png",
      ],
      videoUrl: "https://example.com/seeds/rating/echo-engine/trailer.mp4",
    },
    {
      key: "neon-knuckle",
      leaderId: bob.id,
      title: "Neon Knuckle",
      description: "A one-button score attack brawler about timing dashes through crowded arenas.",
      coverUrl: "https://example.com/seeds/rating/neon-knuckle/cover.png",
      linkWeb: "https://example.com/seeds/rating/neon-knuckle",
      screenshots: [
        "https://example.com/seeds/rating/neon-knuckle/screen-1.png",
        "https://example.com/seeds/rating/neon-knuckle/screen-2.png",
      ],
      videoUrl: "https://example.com/seeds/rating/neon-knuckle/trailer.mp4",
    },
    {
      key: "orbit-orchard",
      leaderId: charlie.id,
      title: "Orbit Orchard",
      description: "Grow fruit on spinning asteroids and fling harvests between tiny moons.",
      coverUrl: "https://example.com/seeds/rating/orbit-orchard/cover.png",
      linkWeb: "https://example.com/seeds/rating/orbit-orchard",
      screenshots: [
        "https://example.com/seeds/rating/orbit-orchard/screen-1.png",
        "https://example.com/seeds/rating/orbit-orchard/screen-2.png",
      ],
      videoUrl: "https://example.com/seeds/rating/orbit-orchard/trailer.mp4",
    },
  ]);

  const finishedRankedSubmissions = await createSeedSubmissions(finishedRankedJam.id, new Date(now - days(24)), [
    {
      key: "loop-lab",
      leaderId: alice.id,
      title: "Loop Lab",
      description: "Chain short time loops together to escape a collapsing research station.",
      coverUrl: "https://example.com/seeds/finished-ranked/loop-lab/cover.png",
      linkWeb: "https://example.com/seeds/finished-ranked/loop-lab",
      screenshots: [
        "https://example.com/seeds/finished-ranked/loop-lab/screen-1.png",
        "https://example.com/seeds/finished-ranked/loop-lab/screen-2.png",
      ],
      videoUrl: "https://example.com/seeds/finished-ranked/loop-lab/trailer.mp4",
    },
    {
      key: "rewind-rally",
      leaderId: bob.id,
      title: "Rewind Rally",
      description: "Race against your previous attempts and exploit their ghost paths to win.",
      coverUrl: "https://example.com/seeds/finished-ranked/rewind-rally/cover.png",
      linkWeb: "https://example.com/seeds/finished-ranked/rewind-rally",
      screenshots: [
        "https://example.com/seeds/finished-ranked/rewind-rally/screen-1.png",
        "https://example.com/seeds/finished-ranked/rewind-rally/screen-2.png",
      ],
      videoUrl: "https://example.com/seeds/finished-ranked/rewind-rally/trailer.mp4",
    },
    {
      key: "spiral-signal",
      leaderId: charlie.id,
      title: "Spiral Signal",
      description: "Decode looping radio transmissions to navigate a storm-wrapped lighthouse.",
      coverUrl: "https://example.com/seeds/finished-ranked/spiral-signal/cover.png",
      linkWeb: "https://example.com/seeds/finished-ranked/spiral-signal",
      screenshots: [
        "https://example.com/seeds/finished-ranked/spiral-signal/screen-1.png",
        "https://example.com/seeds/finished-ranked/spiral-signal/screen-2.png",
      ],
      videoUrl: "https://example.com/seeds/finished-ranked/spiral-signal/trailer.mp4",
    },
  ]);

  const finishedUnrankedSubmissions = await createSeedSubmissions(finishedUnrankedJam.id, new Date(now - days(16)), [
    {
      key: "lantern-post",
      leaderId: alice.id,
      title: "Lantern Post",
      description: "Deliver midnight letters across a sleepy village lit by drifting lanterns.",
      coverUrl: "https://example.com/seeds/finished-casual/lantern-post/cover.png",
      linkWeb: "https://example.com/seeds/finished-casual/lantern-post",
      screenshots: [
        "https://example.com/seeds/finished-casual/lantern-post/screen-1.png",
        "https://example.com/seeds/finished-casual/lantern-post/screen-2.png",
      ],
      videoUrl: "https://example.com/seeds/finished-casual/lantern-post/trailer.mp4",
    },
    {
      key: "paper-kites",
      leaderId: bob.id,
      title: "Paper Kites",
      description: "Guide origami gliders through breezy gardens and rooftop currents.",
      coverUrl: "https://example.com/seeds/finished-casual/paper-kites/cover.png",
      linkWeb: "https://example.com/seeds/finished-casual/paper-kites",
      screenshots: [
        "https://example.com/seeds/finished-casual/paper-kites/screen-1.png",
        "https://example.com/seeds/finished-casual/paper-kites/screen-2.png",
      ],
      videoUrl: "https://example.com/seeds/finished-casual/paper-kites/trailer.mp4",
    },
    {
      key: "tea-trails",
      leaderId: charlie.id,
      title: "Tea Trails",
      description: "Blend herbs and map woodland paths for travelers seeking calm tea spots.",
      coverUrl: "https://example.com/seeds/finished-casual/tea-trails/cover.png",
      linkWeb: "https://example.com/seeds/finished-casual/tea-trails",
      screenshots: [
        "https://example.com/seeds/finished-casual/tea-trails/screen-1.png",
        "https://example.com/seeds/finished-casual/tea-trails/screen-2.png",
      ],
      videoUrl: "https://example.com/seeds/finished-casual/tea-trails/trailer.mp4",
    },
  ]);

  await createRatings(criteriaByJamId.get(ratingJam.id)!, ratingSubmissions, [
    { raterId: alice.id, targetKey: "neon-knuckle", scores: [4, 5, 4] },
    { raterId: alice.id, targetKey: "orbit-orchard", scores: [3, 4, 3] },
    { raterId: bob.id, targetKey: "echo-engine", scores: [5, 5, 4] },
    { raterId: bob.id, targetKey: "orbit-orchard", scores: [4, 4, 5] },
    { raterId: charlie.id, targetKey: "echo-engine", scores: [4, 5, 5] },
    { raterId: charlie.id, targetKey: "neon-knuckle", scores: [3, 4, 4] },
  ]);

  await createRatings(criteriaByJamId.get(finishedRankedJam.id)!, finishedRankedSubmissions, [
    { raterId: alice.id, targetKey: "rewind-rally", scores: [4, 4, 4] },
    { raterId: alice.id, targetKey: "spiral-signal", scores: [5, 5, 4] },
    { raterId: bob.id, targetKey: "loop-lab", scores: [5, 4, 5] },
    { raterId: bob.id, targetKey: "spiral-signal", scores: [3, 4, 3] },
    { raterId: charlie.id, targetKey: "loop-lab", scores: [4, 5, 5] },
    { raterId: charlie.id, targetKey: "rewind-rally", scores: [3, 3, 4] },
  ]);

  console.log(
    `Seed complete: 3 users, ${allJams.length} jams, ${Object.keys(ongoingSubmissions).length + Object.keys(ratingSubmissions).length + Object.keys(finishedRankedSubmissions).length + Object.keys(finishedUnrankedSubmissions).length} submissions, and ratings for 2 ranked jams`
  );
}

main()
  .then(() => prisma.$disconnect())
  .catch((e) => {
    console.error(e);
    prisma.$disconnect();
    process.exit(1);
  });
