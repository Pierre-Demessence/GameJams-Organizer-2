-- CreateEnum
CREATE TYPE "JamStatus" AS ENUM ('DRAFT', 'UPCOMING', 'ONGOING', 'RATING', 'FINISHED');

-- CreateEnum
CREATE TYPE "JamVisibility" AS ENUM ('PUBLIC', 'UNLISTED');

-- CreateEnum
CREATE TYPE "RatingEligibility" AS ENUM ('SUBMITTERS_ONLY', 'SUBMITTERS_AND_CONTRIBUTORS', 'JUDGES_ONLY', 'EVERYONE');

-- CreateEnum
CREATE TYPE "JamRoleType" AS ENUM ('ADMIN', 'MODERATOR', 'JUDGE', 'HOST');

-- CreateEnum
CREATE TYPE "SubmissionStatus" AS ENUM ('DRAFT', 'SUBMITTED');

-- CreateEnum
CREATE TYPE "Platform" AS ENUM ('WINDOWS', 'MAC', 'LINUX', 'WEB');

-- CreateEnum
CREATE TYPE "FieldType" AS ENUM ('SINGLE_LINE', 'MULTI_LINE', 'URL');

-- CreateEnum
CREATE TYPE "CriterionSource" AS ENUM ('RATED', 'JURY');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT,
    "emailVerified" TIMESTAMP(3),
    "passwordHash" TEXT,
    "username" TEXT NOT NULL,
    "displayName" TEXT,
    "bio" TEXT,
    "avatarUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Account" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "providerAccountId" TEXT NOT NULL,
    "refresh_token" TEXT,
    "access_token" TEXT,
    "expires_at" INTEGER,
    "token_type" TEXT,
    "scope" TEXT,
    "id_token" TEXT,

    CONSTRAINT "Account_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Jam" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "shortDesc" TEXT NOT NULL,
    "fullDesc" TEXT NOT NULL,
    "coverUrl" TEXT,
    "hashtag" TEXT,
    "tags" TEXT[],
    "status" "JamStatus" NOT NULL DEFAULT 'DRAFT',
    "visibility" "JamVisibility" NOT NULL DEFAULT 'UNLISTED',
    "ranked" BOOLEAN NOT NULL DEFAULT false,
    "startDate" TIMESTAMP(3),
    "endDate" TIMESTAMP(3),
    "ratingEnd" TIMESTAMP(3),
    "theme" TEXT,
    "revealThemeOnStart" BOOLEAN NOT NULL DEFAULT true,
    "hideResults" BOOLEAN NOT NULL DEFAULT false,
    "hideSubmissionsBeforeEnd" BOOLEAN NOT NULL DEFAULT false,
    "submissionDetails" TEXT,
    "maxTeamSize" INTEGER,
    "allowContributorsAfterClose" BOOLEAN NOT NULL DEFAULT false,
    "ratingEligibility" "RatingEligibility" NOT NULL DEFAULT 'SUBMITTERS_AND_CONTRIBUTORS',
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Jam_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "JamParticipant" (
    "id" TEXT NOT NULL,
    "jamId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,

    CONSTRAINT "JamParticipant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "JamRole" (
    "id" TEXT NOT NULL,
    "jamId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" "JamRoleType" NOT NULL,

    CONSTRAINT "JamRole_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Submission" (
    "id" TEXT NOT NULL,
    "jamId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "coverUrl" TEXT,
    "itchUrl" TEXT,
    "supportedPlatforms" "Platform"[],
    "screenshots" TEXT[],
    "videoUrl" TEXT,
    "status" "SubmissionStatus" NOT NULL DEFAULT 'DRAFT',
    "verificationCode" TEXT,
    "verified" BOOLEAN NOT NULL DEFAULT false,
    "verifiedAt" TIMESTAMP(3),
    "verifiedManually" BOOLEAN NOT NULL DEFAULT false,
    "visible" BOOLEAN NOT NULL DEFAULT true,
    "rateable" BOOLEAN NOT NULL DEFAULT true,
    "competing" BOOLEAN NOT NULL DEFAULT true,
    "moderationReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Submission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SubmissionMember" (
    "id" TEXT NOT NULL,
    "submissionId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "isLeader" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "SubmissionMember_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CustomField" (
    "id" TEXT NOT NULL,
    "jamId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "type" "FieldType" NOT NULL DEFAULT 'SINGLE_LINE',
    "required" BOOLEAN NOT NULL DEFAULT false,
    "isPrivate" BOOLEAN NOT NULL DEFAULT false,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "CustomField_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CustomFieldValue" (
    "id" TEXT NOT NULL,
    "fieldId" TEXT NOT NULL,
    "submissionId" TEXT NOT NULL,
    "value" TEXT NOT NULL,

    CONSTRAINT "CustomFieldValue_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Criterion" (
    "id" TEXT NOT NULL,
    "jamId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "weight" DOUBLE PRECISION NOT NULL DEFAULT 1,
    "source" "CriterionSource" NOT NULL DEFAULT 'RATED',
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "Criterion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Rating" (
    "id" TEXT NOT NULL,
    "submissionId" TEXT NOT NULL,
    "criterionId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "score" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Rating_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "JamResult" (
    "id" TEXT NOT NULL,
    "jamId" TEXT NOT NULL,
    "submissionId" TEXT NOT NULL,
    "rank" INTEGER NOT NULL,
    "finalScore" DOUBLE PRECISION NOT NULL,
    "totalRatings" INTEGER NOT NULL,
    "rawAverage" DOUBLE PRECISION NOT NULL,
    "criteriaScores" JSONB NOT NULL,
    "computedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "JamResult_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "User_username_key" ON "User"("username");

-- CreateIndex
CREATE UNIQUE INDEX "Account_provider_providerAccountId_key" ON "Account"("provider", "providerAccountId");

-- CreateIndex
CREATE UNIQUE INDEX "Jam_slug_key" ON "Jam"("slug");

-- CreateIndex
CREATE INDEX "Jam_status_visibility_idx" ON "Jam"("status", "visibility");

-- CreateIndex
CREATE INDEX "Jam_createdAt_idx" ON "Jam"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "JamParticipant_jamId_userId_key" ON "JamParticipant"("jamId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "JamRole_jamId_userId_role_key" ON "JamRole"("jamId", "userId", "role");

-- CreateIndex
CREATE UNIQUE INDEX "SubmissionMember_submissionId_userId_key" ON "SubmissionMember"("submissionId", "userId");

-- CreateIndex
CREATE INDEX "CustomField_jamId_idx" ON "CustomField"("jamId");

-- CreateIndex
CREATE UNIQUE INDEX "CustomFieldValue_fieldId_submissionId_key" ON "CustomFieldValue"("fieldId", "submissionId");

-- CreateIndex
CREATE INDEX "Rating_submissionId_idx" ON "Rating"("submissionId");

-- CreateIndex
CREATE UNIQUE INDEX "Rating_submissionId_criterionId_userId_key" ON "Rating"("submissionId", "criterionId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "JamResult_jamId_submissionId_key" ON "JamResult"("jamId", "submissionId");

-- AddForeignKey
ALTER TABLE "Account" ADD CONSTRAINT "Account_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Jam" ADD CONSTRAINT "Jam_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JamParticipant" ADD CONSTRAINT "JamParticipant_jamId_fkey" FOREIGN KEY ("jamId") REFERENCES "Jam"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JamParticipant" ADD CONSTRAINT "JamParticipant_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JamRole" ADD CONSTRAINT "JamRole_jamId_fkey" FOREIGN KEY ("jamId") REFERENCES "Jam"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JamRole" ADD CONSTRAINT "JamRole_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Submission" ADD CONSTRAINT "Submission_jamId_fkey" FOREIGN KEY ("jamId") REFERENCES "Jam"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SubmissionMember" ADD CONSTRAINT "SubmissionMember_submissionId_fkey" FOREIGN KEY ("submissionId") REFERENCES "Submission"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SubmissionMember" ADD CONSTRAINT "SubmissionMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomField" ADD CONSTRAINT "CustomField_jamId_fkey" FOREIGN KEY ("jamId") REFERENCES "Jam"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomFieldValue" ADD CONSTRAINT "CustomFieldValue_fieldId_fkey" FOREIGN KEY ("fieldId") REFERENCES "CustomField"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomFieldValue" ADD CONSTRAINT "CustomFieldValue_submissionId_fkey" FOREIGN KEY ("submissionId") REFERENCES "Submission"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Criterion" ADD CONSTRAINT "Criterion_jamId_fkey" FOREIGN KEY ("jamId") REFERENCES "Jam"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Rating" ADD CONSTRAINT "Rating_submissionId_fkey" FOREIGN KEY ("submissionId") REFERENCES "Submission"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Rating" ADD CONSTRAINT "Rating_criterionId_fkey" FOREIGN KEY ("criterionId") REFERENCES "Criterion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Rating" ADD CONSTRAINT "Rating_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JamResult" ADD CONSTRAINT "JamResult_jamId_fkey" FOREIGN KEY ("jamId") REFERENCES "Jam"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JamResult" ADD CONSTRAINT "JamResult_submissionId_fkey" FOREIGN KEY ("submissionId") REFERENCES "Submission"("id") ON DELETE CASCADE ON UPDATE CASCADE;
