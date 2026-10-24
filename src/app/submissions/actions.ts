"use server";

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { findMissingRequiredFields, validateCustomFieldValues } from "@/lib/validations";
import { parseSubmissionForm, readCustomFieldValues } from "@/lib/form-parsers";
import { checkJamPermission } from "@/lib/permissions";
import { checkStaffPermission } from "@/lib/staff-permissions";
import { recordAudit } from "@/lib/audit";
import { checkRateLimit } from "@/lib/rate-limit";
import {
  generateVerificationCode,
  verifyCodeOnItchPage,
} from "@/lib/verification";
import { jamPhase } from "@/domain/jam-phase";
import { canLeaveSubmission } from "@/domain/participation";
import {
  canAcceptInvite,
  canCreateSubmission,
  canDeleteOwnSubmission,
  canEditSubmission,
  canFinalizeSubmission,
  canInviteContributor,
  canRemoveContributor,
  canTransferLeadership,
  canUnsubmit,
} from "@/domain/submission";
import { revalidatePath } from "next/cache";

function isUniqueViolation(err: unknown): boolean {
  return (
    typeof err === "object" &&
    err !== null &&
    "code" in err &&
    (err as { code: string }).code === "P2002"
  );
}

// Soft-deleted submissions are filtered by the db extension; the included jam
// is a relation, so its deletion must be checked here.
async function loadSubmission(submissionId: string) {
  const submission = await db.submission.findUnique({
    where: { id: submissionId },
    include: { jam: true, members: true },
  });
  if (!submission || submission.jam.deletedAt) return null;
  return submission;
}

type Outcome = { error?: string; success?: true };

// A message, not a result object: a shared object would stop TypeScript from normalizing the
// action result unions that the client components rely on.
const THROTTLED_MESSAGE = "Too many requests. Please try again later.";

async function isThrottled(key: string): Promise<boolean> {
  return !(await checkRateLimit(key)).allowed;
}

function hasLiveSubmissionIn(jamId: string, userId: string) {
  return db.submissionMember.findFirst({
    where: { userId, submission: { jamId, deletedAt: null } },
  });
}

export async function createSubmissionAction(jamSlug: string, formData: FormData) {
  const session = await auth();
  if (!session?.user?.id) return { error: "You must be signed in" };

  const { allowed } = await checkRateLimit(`sub:create:${session.user.id}`);
  if (!allowed) return { error: "Too many requests. Please try again later." };

  const jam = await db.jam.findUnique({
    where: { slug: jamSlug },
    include: { customFields: { orderBy: { sortOrder: "asc" } } },
  });
  if (!jam) return { error: "Jam not found" };

  const [participant, existingMembership] = await Promise.all([
    db.jamParticipant.findUnique({
      where: { jamId_userId: { jamId: jam.id, userId: session.user.id } },
    }),
    hasLiveSubmissionIn(jam.id, session.user.id),
  ]);
  const decision = canCreateSubmission({
    phase: jamPhase(jam),
    hasJoined: participant !== null,
    hasSubmission: existingMembership !== null,
  });
  if (!decision.allowed) return { error: decision.reason };

  const parsed = parseSubmissionForm(formData);
  if (!parsed.success) {
    return { error: parsed.error.issues[0].message };
  }

  const fieldValues = readCustomFieldValues(formData, jam.customFields);
  const fieldError = validateCustomFieldValues(jam.customFields, fieldValues);
  if (fieldError) return { error: fieldError };

  // The creator is now on a team, so their invites to other teams in this jam can no longer be accepted.
  let submission;
  try {
    [submission] = await db.$transaction([
      db.submission.create({
        data: {
          jamId: jam.id,
          title: parsed.data.title,
          description: parsed.data.description || null,
          coverUrl: parsed.data.coverUrl || null,
          itchUrl: parsed.data.itchUrl || null,
          supportedPlatforms: parsed.data.supportedPlatforms ?? [],
          verificationCode: parsed.data.itchUrl
            ? generateVerificationCode()
            : null,
          screenshots: parsed.data.screenshots ?? [],
          videoUrl: parsed.data.videoUrl || null,
          members: {
            create: { userId: session.user.id, isLeader: true },
          },
          fieldValues: {
            create: Object.entries(fieldValues)
              .filter(([, value]) => value)
              .map(([fieldId, value]) => ({ fieldId, value })),
          },
        },
      }),
      db.submissionInvite.deleteMany({
        where: { inviteeId: session.user.id, submission: { jamId: jam.id } },
      }),
    ]);
  } catch (err: unknown) {
    if (isUniqueViolation(err)) {
      return { error: "You already have a submission in this jam" };
    }
    return { error: "Failed to create submission" };
  }

  revalidatePath(`/jams/${jamSlug}`);
  return { success: true, submissionId: submission.id };
}

export async function updateSubmissionAction(
  submissionId: string,
  formData: FormData
) {
  const session = await auth();
  if (!session?.user?.id) return { error: "You must be signed in" };
  const userId = session.user.id;

  const submission = await loadSubmission(submissionId);
  if (!submission) return { error: "Submission not found" };

  const decision = canEditSubmission({
    phase: jamPhase(submission.jam),
    isMember: submission.members.some((m) => m.userId === userId),
    canEditAny: await checkJamPermission(submission.jamId, userId, "edit_submission"),
  });
  if (!decision.allowed) return { error: decision.reason };

  const parsed = parseSubmissionForm(formData);
  if (!parsed.success) {
    return { error: parsed.error.issues[0].message };
  }

  const customFields = await db.customField.findMany({
    where: { jamId: submission.jamId },
  });
  const fieldValues = readCustomFieldValues(formData, customFields);
  const fieldError = validateCustomFieldValues(customFields, fieldValues);
  if (fieldError) return { error: fieldError };

  // Changing the verified game link returns the submission to DRAFT for re-verification.
  const newItchUrl = parsed.data.itchUrl || null;
  const linkChanged = newItchUrl !== submission.itchUrl;

  const fieldWrites = Object.entries(fieldValues).map(([fieldId, value]) =>
    value
      ? db.customFieldValue.upsert({
          where: { fieldId_submissionId: { fieldId, submissionId } },
          create: { fieldId, submissionId, value },
          update: { value },
        })
      : db.customFieldValue.deleteMany({ where: { fieldId, submissionId } })
  );

  await db.$transaction([
    db.submission.update({
      where: { id: submissionId },
      data: {
        title: parsed.data.title,
        description: parsed.data.description || null,
        coverUrl: parsed.data.coverUrl || null,
        itchUrl: newItchUrl,
        supportedPlatforms: parsed.data.supportedPlatforms ?? [],
        screenshots: parsed.data.screenshots ?? [],
        videoUrl: parsed.data.videoUrl || null,
        ...(linkChanged
          ? {
              verificationCode: newItchUrl ? generateVerificationCode() : null,
              verified: false,
              verifiedManually: false,
              verifiedAt: null,
              status: "DRAFT" as const,
            }
          : {}),
      },
    }),
    ...fieldWrites,
  ]);

  revalidatePath(`/submissions/${submissionId}`);
  revalidatePath(`/jams/${submission.jam.slug}`);
  return { success: true };
}

export async function inviteContributorAction(
  submissionId: string,
  contributorUsername: string
) {
  const session = await auth();
  if (!session?.user?.id) return { error: "You must be signed in" };
  const userId = session.user.id;

  if (await isThrottled(`sub:invite:${userId}`)) return { error: THROTTLED_MESSAGE };

  const submission = await loadSubmission(submissionId);
  if (!submission) return { error: "Submission not found" };

  const invitee = await db.user.findUnique({
    where: { username: contributorUsername, deletedAt: null },
    select: { id: true },
  });
  if (!invitee) return { error: "User not found" };

  const [participant, liveSubmission, existingInvite, pendingInvites] = await Promise.all([
    db.jamParticipant.findUnique({
      where: { jamId_userId: { jamId: submission.jamId, userId: invitee.id } },
    }),
    hasLiveSubmissionIn(submission.jamId, invitee.id),
    db.submissionInvite.findUnique({
      where: { submissionId_inviteeId: { submissionId, inviteeId: invitee.id } },
    }),
    db.submissionInvite.count({ where: { submissionId } }),
  ]);
  const decision = canInviteContributor({
    phase: jamPhase(submission.jam),
    ranked: submission.jam.ranked,
    allowContributorsAfterClose: submission.jam.allowContributorsAfterClose,
    isMember: submission.members.some((m) => m.userId === userId),
    teamSize: submission.members.length,
    pendingInvites,
    maxTeamSize: submission.jam.maxTeamSize,
    invitee: {
      hasJoined: participant !== null,
      hasLiveSubmission: liveSubmission !== null,
      alreadyInvited: existingInvite !== null,
    },
  });
  if (!decision.allowed) return { error: decision.reason };

  try {
    await db.submissionInvite.create({
      data: { submissionId, inviteeId: invitee.id, invitedById: userId },
    });
  } catch (err: unknown) {
    if (isUniqueViolation(err)) {
      return { error: "User is already invited to this submission" };
    }
    return { error: "Failed to send the invite" };
  }

  revalidatePath(`/submissions/${submissionId}`);
  return { success: true };
}

// Any member may withdraw a pending invite. A non-member gets "not found" so invites stay private.
export async function cancelInviteAction(inviteId: string) {
  const session = await auth();
  if (!session?.user?.id) return { error: "You must be signed in" };
  const userId = session.user.id;

  if (await isThrottled(`sub:invite-cancel:${userId}`)) return { error: THROTTLED_MESSAGE };

  const invite = await db.submissionInvite.findUnique({
    where: { id: inviteId },
    select: { submissionId: true },
  });
  const submission = invite && (await loadSubmission(invite.submissionId));
  if (!submission || !submission.members.some((m) => m.userId === userId)) {
    return { error: "Invite not found" };
  }

  await db.submissionInvite.deleteMany({ where: { id: inviteId } });

  revalidatePath(`/submissions/${submission.id}`);
  return { success: true };
}

export async function declineInviteAction(inviteId: string) {
  const session = await auth();
  if (!session?.user?.id) return { error: "You must be signed in" };
  const userId = session.user.id;

  if (await isThrottled(`sub:invite-decline:${userId}`)) return { error: THROTTLED_MESSAGE };

  const { count } = await db.submissionInvite.deleteMany({
    where: { id: inviteId, inviteeId: userId },
  });
  if (count === 0) return { error: "Invite not found" };

  return { success: true };
}

export async function acceptInviteAction(inviteId: string) {
  const session = await auth();
  if (!session?.user?.id) return { error: "You must be signed in" };
  const userId = session.user.id;

  if (await isThrottled(`sub:invite-accept:${userId}`)) return { error: THROTTLED_MESSAGE };

  const invite = await db.submissionInvite.findFirst({
    where: { id: inviteId, inviteeId: userId },
    select: { submissionId: true },
  });
  const loaded = invite && (await loadSubmission(invite.submissionId));
  if (!loaded) return { error: "Invite not found" };
  const { jam } = loaded;

  try {
    const result = await db.$transaction(async (tx): Promise<Outcome> => {
      // Lock the invitee's participant row, then the team's row, so concurrent accepts queue up:
      // one user accepting two invites, or two users taking the last seat, each re-check the
      // rules below against committed state instead of racing past them.
      const participant = await tx.$queryRaw<{ id: string }[]>`
        SELECT "id" FROM "JamParticipant"
        WHERE "jamId" = ${jam.id} AND "userId" = ${userId} FOR UPDATE
      `;
      await tx.$queryRaw`SELECT "id" FROM "Submission" WHERE "id" = ${loaded.id} FOR UPDATE`;

      const submission = await tx.submission.findUnique({ where: { id: loaded.id } });
      if (!submission) return { error: "Invite not found" };

      const teamSize = await tx.submissionMember.count({ where: { submissionId: submission.id } });
      const liveSubmission = await tx.submissionMember.findFirst({
        where: { userId, submission: { jamId: jam.id, deletedAt: null } },
      });
      const decision = canAcceptInvite({
        phase: jamPhase(jam),
        ranked: jam.ranked,
        allowContributorsAfterClose: jam.allowContributorsAfterClose,
        hasJoined: participant.length > 0,
        hasLiveSubmission: liveSubmission !== null,
        teamSize,
        maxTeamSize: jam.maxTeamSize,
      });
      if (!decision.allowed) return { error: decision.reason };

      await tx.submissionMember.create({
        data: { submissionId: submission.id, userId, isLeader: false },
      });
      await tx.submissionInvite.deleteMany({
        where: { inviteeId: userId, submission: { jamId: jam.id } },
      });
      return { success: true };
    });
    if (result.success) {
      revalidatePath(`/submissions/${loaded.id}`);
      revalidatePath(`/jams/${jam.slug}`);
    }
    return result;
  } catch (err: unknown) {
    if (isUniqueViolation(err)) return { error: "You are already on this team" };
    return { error: "Failed to accept the invite" };
  }
}

export async function leaveSubmissionAction(submissionId: string) {
  const session = await auth();
  if (!session?.user?.id) return { error: "You must be signed in" };
  const userId = session.user.id;

  if (await isThrottled(`sub:leave:${userId}`)) return { error: THROTTLED_MESSAGE };

  const submission = await loadSubmission(submissionId);
  if (!submission) return { error: "Submission not found" };

  const own = submission.members.find((m) => m.userId === userId);
  if (!own) return { error: "You are not on this team" };

  const decision = canLeaveSubmission({
    phase: jamPhase(submission.jam),
    isLeader: own.isLeader,
  });
  if (!decision.allowed) return { error: decision.reason };

  // The `isLeader` guard is re-evaluated by Postgres after any lock wait, so a transfer that makes
  // this member the leader between the read above and this delete cannot leave the team leaderless.
  const { count } = await db.submissionMember.deleteMany({ where: { id: own.id, isLeader: false } });
  if (count === 0) return { error: "Your role on this team changed: reload and try again" };

  revalidatePath(`/submissions/${submissionId}`);
  revalidatePath(`/jams/${submission.jam.slug}`);
  return { success: true };
}

export async function removeContributorAction(
  submissionId: string,
  contributorUserId: string
) {
  const session = await auth();
  if (!session?.user?.id) return { error: "You must be signed in" };
  const userId = session.user.id;

  if (await isThrottled(`sub:remove:${userId}`)) return { error: THROTTLED_MESSAGE };

  const submission = await loadSubmission(submissionId);
  if (!submission) return { error: "Submission not found" };

  const target = submission.members.find((m) => m.userId === contributorUserId);
  if (!target) return { error: "User is not on this team" };

  const decision = canRemoveContributor({
    phase: jamPhase(submission.jam),
    ranked: submission.jam.ranked,
    allowContributorsAfterClose: submission.jam.allowContributorsAfterClose,
    isMember: submission.members.some((m) => m.userId === userId),
    targetIsLeader: target.isLeader,
  });
  if (!decision.allowed) return { error: decision.reason };

  const { count } = await db.submissionMember.deleteMany({ where: { id: target.id, isLeader: false } });
  if (count === 0) return { error: "That member's role changed: reload and try again" };

  revalidatePath(`/submissions/${submissionId}`);
  return { success: true };
}

export async function transferLeaderAction(
  submissionId: string,
  newLeaderUserId: string
) {
  const session = await auth();
  if (!session?.user?.id) return { error: "You must be signed in" };
  const userId = session.user.id;

  if (await isThrottled(`sub:transfer:${userId}`)) return { error: THROTTLED_MESSAGE };

  const submission = await loadSubmission(submissionId);
  if (!submission) return { error: "Submission not found" };

  const currentLeader = submission.members.find((m) => m.userId === userId && m.isLeader);
  const newLeader = submission.members.find((m) => m.userId === newLeaderUserId);

  const decision = canTransferLeadership({
    isLeader: currentLeader !== undefined,
    targetIsMember: newLeader !== undefined,
  });
  if (!decision.allowed || !currentLeader || !newLeader) {
    return { error: decision.allowed ? "User is not on this team" : decision.reason };
  }

  await db.$transaction([
    db.submissionMember.update({
      where: { id: currentLeader.id },
      data: { isLeader: false },
    }),
    db.submissionMember.update({
      where: { id: newLeader.id },
      data: { isLeader: true },
    }),
  ]);

  revalidatePath(`/submissions/${submissionId}`);
  return { success: true };
}

// ─── Moderation ─────────────────────────────────
// Three independent switches (visible / rateable / competing) composed through presets.

type ModerationSwitches = {
  visible?: boolean;
  rateable?: boolean;
  competing?: boolean;
  moderationReason?: string | null;
};

async function moderate(
  submissionId: string,
  switches: (current: { visible: boolean }) => ModerationSwitches
) {
  const session = await auth();
  if (!session?.user?.id) return { error: "You must be signed in" };

  const submission = await loadSubmission(submissionId);
  if (!submission) return { error: "Submission not found" };
  const canModerate = await checkJamPermission(
    submission.jamId,
    session.user.id,
    "moderate_submission"
  );
  if (!canModerate) return { error: "You do not have permission" };

  await db.submission.update({
    where: { id: submissionId },
    data: switches(submission),
  });

  revalidatePath(`/submissions/${submissionId}`);
  revalidatePath(`/jams/${submission.jam.slug}`);
  return { success: true };
}

// Disqualify: stays visible, but cannot be rated and does not compete.
export async function disqualifySubmissionAction(submissionId: string, reason?: string) {
  return moderate(submissionId, () => ({
    rateable: false,
    competing: false,
    moderationReason: reason?.trim() || "Disqualified",
  }));
}

// Exclude from ranking: stays visible and rateable, but does not compete.
export async function excludeFromRankingAction(submissionId: string, reason?: string) {
  return moderate(submissionId, () => ({
    rateable: true,
    competing: false,
    moderationReason: reason?.trim() || "Not competing",
  }));
}

export async function reinstateSubmissionAction(submissionId: string) {
  return moderate(submissionId, () => ({
    visible: true,
    rateable: true,
    competing: true,
    moderationReason: null,
  }));
}

export async function hideSubmissionAction(submissionId: string) {
  return moderate(submissionId, (current) => ({ visible: !current.visible }));
}

export async function deleteSubmissionAction(submissionId: string) {
  const session = await auth();
  if (!session?.user?.id) return { error: "You must be signed in" };

  const submission = await loadSubmission(submissionId);
  if (!submission) return { error: "Submission not found" };

  const leader = submission.members.find((m) => m.isLeader);
  const ownDelete = canDeleteOwnSubmission({
    phase: jamPhase(submission.jam),
    isLeader: leader?.userId === session.user.id,
  });
  const isOrganizer = await checkJamPermission(
    submission.jamId,
    session.user.id,
    "delete_submission"
  );
  const isStaff =
    !ownDelete.allowed &&
    !isOrganizer &&
    (await checkStaffPermission(session.user.id, "moderate_any_submission"));
  if (!ownDelete.allowed && !isOrganizer && !isStaff) {
    return { error: leader?.userId === session.user.id ? ownDelete.reason : "You do not have permission" };
  }

  await db.submission.update({
    where: { id: submissionId },
    data: { deletedAt: new Date() },
  });

  if (isStaff) {
    await recordAudit({
      actorId: session.user.id,
      action: "submission:soft_delete",
      targetType: "submission",
      targetId: submissionId,
      metadata: { jamId: submission.jamId, title: submission.title },
    });
  }

  revalidatePath(`/jams/${submission.jam.slug}`);
  return { success: true };
}

// ─── Ownership verification & submission lifecycle ──────────────

async function requireTeamMember(submissionId: string, userId: string) {
  const submission = await loadSubmission(submissionId);
  if (!submission) return { error: "Submission not found" as const };
  const isMember = submission.members.some((m) => m.userId === userId);
  if (!isMember) return { error: "You are not on this team" as const };
  return { submission };
}

export async function verifySubmissionAction(submissionId: string) {
  const session = await auth();
  if (!session?.user?.id) return { error: "You must be signed in" };

  const { allowed } = await checkRateLimit(`verify:${session.user.id}`);
  if (!allowed) return { error: "Too many requests. Please try again later." };

  const result = await requireTeamMember(submissionId, session.user.id);
  if ("error" in result) return { error: result.error };
  const { submission } = result;

  if (!submission.itchUrl || !submission.verificationCode) {
    return { error: "Add your itch.io project link first" };
  }
  if (submission.verified) return { success: true };

  const ok = await verifyCodeOnItchPage(
    submission.itchUrl,
    submission.verificationCode
  );
  if (!ok) {
    return {
      error:
        "Could not find the verification code on the itch.io page. Make sure it is published, then try again.",
    };
  }

  await db.submission.update({
    where: { id: submissionId },
    data: { verified: true, verifiedAt: new Date() },
  });

  revalidatePath(`/submissions/${submissionId}`);
  return { success: true };
}

export async function manualVerifySubmissionAction(submissionId: string) {
  const session = await auth();
  if (!session?.user?.id) return { error: "You must be signed in" };

  const submission = await loadSubmission(submissionId);
  if (!submission) return { error: "Submission not found" };

  const canVerify = await checkJamPermission(
    submission.jamId,
    session.user.id,
    "verify_submission"
  );
  if (!canVerify) return { error: "You do not have permission" };

  await db.submission.update({
    where: { id: submissionId },
    data: { verified: true, verifiedManually: true, verifiedAt: new Date() },
  });

  revalidatePath(`/submissions/${submissionId}`);
  return { success: true };
}

export async function submitSubmissionAction(submissionId: string) {
  const session = await auth();
  if (!session?.user?.id) return { error: "You must be signed in" };

  const result = await requireTeamMember(submissionId, session.user.id);
  if ("error" in result) return { error: result.error };
  const { submission } = result;

  const requiredFields = await db.customField.findMany({
    where: { jamId: submission.jamId, required: true },
    orderBy: { sortOrder: "asc" },
    include: { values: { where: { submissionId } } },
  });
  const decision = canFinalizeSubmission({
    phase: jamPhase(submission.jam),
    hasItchUrl: Boolean(submission.itchUrl),
    verified: submission.verified,
    missingRequiredFields: findMissingRequiredFields(
      requiredFields.map((field) => ({
        name: field.name,
        required: field.required,
        value: field.values[0]?.value,
      }))
    ),
  });
  if (!decision.allowed) return { error: decision.reason };

  await db.submission.update({
    where: { id: submissionId },
    data: { status: "SUBMITTED" },
  });

  revalidatePath(`/submissions/${submissionId}`);
  revalidatePath(`/jams/${submission.jam.slug}`);
  return { success: true };
}

export async function unsubmitSubmissionAction(submissionId: string) {
  const session = await auth();
  if (!session?.user?.id) return { error: "You must be signed in" };

  const result = await requireTeamMember(submissionId, session.user.id);
  if ("error" in result) return { error: result.error };
  const { submission } = result;

  const decision = canUnsubmit({ phase: jamPhase(submission.jam) });
  if (!decision.allowed) return { error: decision.reason };

  await db.submission.update({
    where: { id: submissionId },
    data: { status: "DRAFT" },
  });

  revalidatePath(`/submissions/${submissionId}`);
  revalidatePath(`/jams/${submission.jam.slug}`);
  return { success: true };
}
