import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { hashSync } from "bcryptjs";
import "dotenv/config";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

function days(n: number) {
  return n * 24 * 60 * 60 * 1000;
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
    update: {},
    create: {
      name: "Upcoming Jam",
      slug: "upcoming-jam",
      shortDesc: "Get ready — this jam starts soon!",
      fullDesc: "# Upcoming Jam\n\nPrepare your tools and team. The theme will be revealed at the start.",
      tags: ["upcoming", "beginner-friendly"],
      ranked: true,
      visibility: "PUBLIC",
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
  const ongoingJam = await prisma.jam.upsert({
    where: { slug: "ongoing-jam" },
    update: {},
    create: {
      name: "Ongoing Jam",
      slug: "ongoing-jam",
      shortDesc: "This jam is happening right now!",
      fullDesc: "# Ongoing Jam\n\nSubmissions are open. Build something amazing before the deadline.",
      tags: ["active", "solo"],
      ranked: true,
      visibility: "PUBLIC",
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
    update: {},
    create: {
      name: "Rating Jam",
      slug: "rating-jam",
      shortDesc: "Submissions are closed — time to rate!",
      fullDesc: "# Rating Jam\n\nPlay and rate the entries before the rating period ends.",
      tags: ["rating", "competitive"],
      ranked: true,
      visibility: "PUBLIC",
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
    update: {},
    create: {
      name: "Finished Ranked Jam",
      slug: "finished-ranked-jam",
      shortDesc: "This jam is over — check out the results!",
      fullDesc: "# Finished Ranked Jam\n\nThe results are in. See who won!",
      tags: ["finished", "competitive"],
      ranked: true,
      visibility: "PUBLIC",
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
    update: {},
    create: {
      name: "Finished Casual Jam",
      slug: "finished-unranked-jam",
      shortDesc: "A casual jam that has ended.",
      fullDesc: "# Finished Casual Jam\n\nNo rankings — just fun and creativity.",
      tags: ["finished", "casual"],
      ranked: false,
      visibility: "PUBLIC",
      startDate: new Date(now - days(21)),
      endDate: new Date(now - days(14)),
      createdById: bob.id,
    },
  });

  // UPCOMING + UNLISTED: private jam accessible only via link
  const unlistedJam = await prisma.jam.upsert({
    where: { slug: "private-friends-jam" },
    update: {},
    create: {
      name: "Private Friends Jam",
      slug: "private-friends-jam",
      shortDesc: "An invite-only jam for friends.",
      fullDesc: "# Private Friends Jam\n\nThis jam is unlisted — share the link with your group.",
      tags: ["private"],
      ranked: false,
      visibility: "UNLISTED",
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
      where: { jamId_userId: { jamId: jam.id, userId: owner.id } },
      update: {},
      create: { jamId: jam.id, userId: owner.id, role: "ADMIN" },
    });
  }

  // Add criteria to ranked jams
  const rankedJams = [upcomingJam, ongoingJam, ratingJam, finishedRankedJam];
  for (const jam of rankedJams) {
    await prisma.criterion.createMany({
      data: [
        { jamId: jam.id, name: "Fun", description: "How fun is the game?", weight: 1, sortOrder: 0 },
        { jamId: jam.id, name: "Creativity", description: "How creative is the concept?", weight: 1, sortOrder: 1 },
        { jamId: jam.id, name: "Theme", description: "How well does it fit the theme?", weight: 0.5, sortOrder: 2 },
      ],
      skipDuplicates: true,
    });
  }

  // Add participants to ongoing and rating jams
  for (const jam of [ongoingJam, ratingJam]) {
    for (const user of [alice, bob, charlie]) {
      await prisma.jamParticipant.upsert({
        where: { jamId_userId: { jamId: jam.id, userId: user.id } },
        update: {},
        create: { jamId: jam.id, userId: user.id },
      });
    }
  }

  console.log(`Seed complete: 3 users, ${allJams.length} jams (draft, upcoming, ongoing, rating, finished-ranked, finished-unranked, unlisted)`);
}

main()
  .then(() => prisma.$disconnect())
  .catch((e) => {
    console.error(e);
    prisma.$disconnect();
    process.exit(1);
  });
