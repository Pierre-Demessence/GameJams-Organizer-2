import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { hashSync } from "bcryptjs";
import "dotenv/config";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

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

  const now = new Date();
  const oneWeekFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
  const twoWeeksFromNow = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000);
  const threeWeeksFromNow = new Date(now.getTime() + 21 * 24 * 60 * 60 * 1000);

  const jam = await prisma.jam.upsert({
    where: { slug: "spring-jam-2026" },
    update: {},
    create: {
      name: "Spring Jam 2026",
      slug: "spring-jam-2026",
      shortDesc: "A fun game jam to kick off spring!",
      fullDesc:
        "# Spring Jam 2026\n\nCreate a game around the theme of renewal and growth. " +
        "Solo or team entries welcome.\n\n## Rules\n- All assets must be created during the jam\n" +
        "- Use any engine you like",
      tags: ["spring", "beginner-friendly"],
      ranked: true,
      visibility: "PUBLISHED",
      startDate: oneWeekFromNow,
      endDate: twoWeeksFromNow,
      ratingEnd: threeWeeksFromNow,
      theme: "Growth",
      revealThemeOnStart: true,
      ratingEligibility: "SUBMITTERS_AND_CONTRIBUTORS",
      createdById: alice.id,
    },
  });

  await prisma.jamRole.upsert({
    where: { jamId_userId: { jamId: jam.id, userId: alice.id } },
    update: {},
    create: {
      jamId: jam.id,
      userId: alice.id,
      role: "ADMIN",
    },
  });

  await prisma.criterion.createMany({
    data: [
      { jamId: jam.id, name: "Fun", description: "How fun is the game?", weight: 1, sortOrder: 0 },
      { jamId: jam.id, name: "Creativity", description: "How creative is the concept?", weight: 1, sortOrder: 1 },
      { jamId: jam.id, name: "Theme", description: "How well does it fit the theme?", weight: 0.5, sortOrder: 2 },
    ],
    skipDuplicates: true,
  });

  for (const user of [alice, bob, charlie]) {
    await prisma.jamParticipant.upsert({
      where: { jamId_userId: { jamId: jam.id, userId: user.id } },
      update: {},
      create: { jamId: jam.id, userId: user.id },
    });
  }

  console.log("Seed complete: 3 users, 1 jam, 3 criteria, 3 participants");
}

main()
  .then(() => prisma.$disconnect())
  .catch((e) => {
    console.error(e);
    prisma.$disconnect();
    process.exit(1);
  });
