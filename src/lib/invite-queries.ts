import { db } from "@/lib/db";
import { jamPhase, type JamPhaseInput } from "@/domain/jam-phase";
import { isContributorWindowOpen } from "@/domain/submission";

export interface SubmissionInviteView {
  id: string;
  username: string;
  displayName: string | null;
}

export interface ViewerInviteView {
  id: string;
  submissionTitle: string;
  inviterName: string;
}

// Invites only exist while they can still be acted on: a closed window or a deleted
// submission hides them (spec §5), and nothing here deletes them.

export async function loadSubmissionInvites(submissionId: string): Promise<SubmissionInviteView[]> {
  const submission = await db.submission.findUnique({
    where: { id: submissionId },
    select: { jam: true },
  });
  if (!submission || submission.jam.deletedAt) return [];
  if (!isContributorWindowOpen({ phase: jamPhase(submission.jam), ...submission.jam })) return [];

  const invites = await db.submissionInvite.findMany({
    where: { submissionId },
    orderBy: { createdAt: "asc" },
    select: { id: true, invitee: { select: { username: true, displayName: true } } },
  });
  return invites.map((i) => ({ id: i.id, ...i.invitee }));
}

// The caller already holds the jam, so it is passed in rather than loaded again.
export async function loadViewerInvites(
  jam: JamPhaseInput & { id: string; allowContributorsAfterClose: boolean },
  userId: string
): Promise<ViewerInviteView[]> {
  if (!isContributorWindowOpen({ phase: jamPhase(jam), ...jam })) return [];

  const invites = await db.submissionInvite.findMany({
    where: { inviteeId: userId, submission: { jamId: jam.id, deletedAt: null } },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      submission: { select: { title: true } },
      invitedBy: { select: { username: true, displayName: true } },
    },
  });
  return invites.map((i) => ({
    id: i.id,
    submissionTitle: i.submission.title,
    inviterName: i.invitedBy.displayName ?? i.invitedBy.username,
  }));
}
