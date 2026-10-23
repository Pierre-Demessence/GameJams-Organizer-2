-- CreateTable
CREATE TABLE "SubmissionInvite" (
    "id" TEXT NOT NULL,
    "submissionId" TEXT NOT NULL,
    "inviteeId" TEXT NOT NULL,
    "invitedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SubmissionInvite_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SubmissionInvite_inviteeId_idx" ON "SubmissionInvite"("inviteeId");

-- CreateIndex
CREATE UNIQUE INDEX "SubmissionInvite_submissionId_inviteeId_key" ON "SubmissionInvite"("submissionId", "inviteeId");

-- AddForeignKey
ALTER TABLE "SubmissionInvite" ADD CONSTRAINT "SubmissionInvite_submissionId_fkey" FOREIGN KEY ("submissionId") REFERENCES "Submission"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SubmissionInvite" ADD CONSTRAINT "SubmissionInvite_inviteeId_fkey" FOREIGN KEY ("inviteeId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SubmissionInvite" ADD CONSTRAINT "SubmissionInvite_invitedById_fkey" FOREIGN KEY ("invitedById") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
