-- DropForeignKey
ALTER TABLE "JamResult" DROP CONSTRAINT "JamResult_jamId_fkey";

-- DropForeignKey
ALTER TABLE "JamResult" DROP CONSTRAINT "JamResult_submissionId_fkey";

-- DropTable
DROP TABLE "JamResult";

