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
import {
  canAddContributor,
  canCreateSubmission,
  canEditSubmission,
  canFinalizeSubmission,
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

function hasLiveSubmissionIn(jamId: string, userId: string) {
  return db.submissionMember.findFirst({
    where: { userId, submission: { jamId, deletedAt: null } },
  });
}

export async function createSubmissionAction(jamSlug: string, formData: FormData) {
  const session = await auth();
  if (!session?.user?.id) return { error: "You must be signed in" };

  const { allowed } = checkRateLimit(`sub:create:${session.user.id}`);
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

  let submission;
  try {
    submission = await db.submission.create({
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
    });
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

export async function addContributorAction(
  submissionId: string,
  contributorUsername: string
) {
  const session = await auth();
  if (!session?.user?.id) return { error: "You must be signed in" };
  const userId = session.user.id;

  const submission = await loadSubmission(submissionId);
  if (!submission) return { error: "Submission not found" };

  const decision = canAddContributor({
    phase: jamPhase(submission.jam),
    ranked: submission.jam.ranked,
    allowContributorsAfterClose: submission.jam.allowContributorsAfterClose,
    isMember: submission.members.some((m) => m.userId === userId),
    teamSize: submission.members.length,
    maxTeamSize: submission.jam.maxTeamSize,
  });
  if (!decision.allowed) return { error: decision.reason };

  const contributor = await db.user.findUnique({
    where: { username: contributorUsername },
    select: { id: true },
  });
  if (!contributor) return { error: "User not found" };

  const isParticipant = await db.jamParticipant.findUnique({
    where: {
      jamId_userId: { jamId: submission.jamId, userId: contributor.id },
    },
  });
  if (!isParticipant) {
    return { error: "User must join the jam first" };
  }

  if (await hasLiveSubmissionIn(submission.jamId, contributor.id)) {
    return { error: "User is already part of a submission in this jam" };
  }

  try {
    await db.submissionMember.create({
      data: { submissionId, userId: contributor.id, isLeader: false },
    });
  } catch (err: unknown) {
    if (isUniqueViolation(err)) {
      return { error: "User is already on this team" };
    }
    return { error: "Failed to add contributor" };
  }

  revalidatePath(`/submissions/${submissionId}`);
  return { success: true };
}

export async function removeContributorAction(
  submissionId: string,
  contributorUserId: string
) {
  const session = await auth();
  if (!session?.user?.id) return { error: "You must be signed in" };
  const userId = session.user.id;

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

  await db.submissionMember.delete({ where: { id: target.id } });

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

  const isOrganizer = await checkJamPermission(
    submission.jamId,
    session.user.id,
    "delete_submission"
  );
  const isStaff = await checkStaffPermission(
    session.user.id,
    "moderate_any_submission"
  );
  if (!isOrganizer && !isStaff) return { error: "You do not have permission" };

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

  const { allowed } = checkRateLimit(`verify:${session.user.id}`);
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
