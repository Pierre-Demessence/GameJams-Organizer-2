-- AlterTable
ALTER TABLE "Jam" ADD COLUMN     "publishedAt" TIMESTAMP(3),
ADD COLUMN     "resultsRevealedAt" TIMESTAMP(3);

-- Backfill: before this migration any jam with both dates was already live, so
-- treat it as published at creation to keep existing jams in their current phase.
UPDATE "Jam" SET "publishedAt" = "createdAt"
WHERE "startDate" IS NOT NULL AND "endDate" IS NOT NULL;

-- DropIndex
DROP INDEX "Jam_status_visibility_idx";

-- AlterTable
ALTER TABLE "Jam" DROP COLUMN "status";

-- DropEnum
DROP TYPE "JamStatus";

-- CreateIndex
CREATE INDEX "Jam_visibility_publishedAt_idx" ON "Jam"("visibility", "publishedAt");
