"use server";

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { submissionSchema } from "@/lib/validations";
import { computeJamStatus } from "@/lib/jam-status";
import { checkJamPermission } from "@/lib/permissions";
import { checkRateLimit } from "@/lib/rate-limit";
import { revalidatePath } from "next/cache";

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

  const status = computeJamStatus(jam);
  if (status !== "ONGOING") {
    return { error: "Submissions are only accepted during the ongoing period" };
  }

  // Check user is a participant
  const participant = await db.jamParticipant.findUnique({
    where: { jamId_userId: { jamId: jam.id, userId: session.user.id } },
  });
  if (!participant) {
    return { error: "You must join this jam before submitting" };
  }

  // One submission per user per jam
  const existingMembership = await db.submissionMember.findFirst({
    where: {
      userId: session.user.id,
      submission: { jamId: jam.id },
    },
  });
  if (existingMembership) {
    return { error: "You already have a submission in this jam" };
  }

  const raw = Object.fromEntries(formData.entries());
  const parsed = submissionSchema.safeParse({
    ...raw,
    screenshots: raw.screenshots
      ? String(raw.screenshots).split(",").map((s) => s.trim()).filter(Boolean)
      : [],
    coverUrl: raw.coverUrl || undefined,
    linkWindows: raw.linkWindows || undefined,
    linkMac: raw.linkMac || undefined,
    linkLinux: raw.linkLinux || undefined,
    linkWeb: raw.linkWeb || undefined,
    videoUrl: raw.videoUrl || undefined,
    description: raw.description || undefined,
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0].message };
  }

  // Validate required custom fields and URL types
  for (const field of jam.customFields) {
    const value = (formData.get(`custom_${field.id}`) as string) ?? "";
    if (field.required && !value.trim()) {
      return { error: `${field.name} is required` };
    }
    if (field.type === "URL" && value.trim()) {
      try {
        const url = new URL(value.trim());
        if (url.protocol !== "http:" && url.protocol !== "https:") {
          return { error: `${field.name} must be an http or https URL` };
        }
      } catch {
        return { error: `${field.name} must be a valid URL` };
      }
    }
  }

  let submission;
  try {
    submission = await db.submission.create({
      data: {
        jamId: jam.id,
        title: parsed.data.title,
        description: parsed.data.description || null,
        coverUrl: parsed.data.coverUrl || null,
        linkWindows: parsed.data.linkWindows || null,
        linkMac: parsed.data.linkMac || null,
        linkLinux: parsed.data.linkLinux || null,
        linkWeb: parsed.data.linkWeb || null,
        screenshots: parsed.data.screenshots ?? [],
        videoUrl: parsed.data.videoUrl || null,
        members: {
          create: { userId: session.user.id, isLeader: true },
        },
        fieldValues: {
          create: jam.customFields
            .map((field) => ({
              fieldId: field.id,
              value: (formData.get(`custom_${field.id}`) as string) ?? "",
            }))
            .filter((fv) => fv.value),
        },
      },
    });
  } catch (err: unknown) {
    if (
      typeof err === "object" &&
      err !== null &&
      "code" in err &&
      (err as { code: string }).code === "P2002"
    ) {
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

  const submission = await db.submission.findUnique({
    where: { id: submissionId },
    include: {
      jam: true,
      members: true,
    },
  });
  if (!submission) return { error: "Submission not found" };

  const status = computeJamStatus(submission.jam);
  if (status !== "ONGOING") {
    // Check if admin/moderator can edit outside ONGOING
    const canEditAny = await checkJamPermission(
      submission.jamId,
      session.user.id,
      "edit_submission"
    );
    if (!canEditAny) {
      return { error: "Submissions can only be edited during the ongoing period" };
    }
  } else {
    // During ONGOING, check if user is a member
    const isMember = submission.members.some(
      (m) => m.userId === session.user!.id
    );
    const canEditAny = await checkJamPermission(
      submission.jamId,
      session.user.id,
      "edit_submission"
    );
    if (!isMember && !canEditAny) {
      return { error: "You do not have permission to edit this submission" };
    }
  }

  const raw = Object.fromEntries(formData.entries());
  const parsed = submissionSchema.safeParse({
    ...raw,
    screenshots: raw.screenshots
      ? String(raw.screenshots).split(",").map((s) => s.trim()).filter(Boolean)
      : [],
    coverUrl: raw.coverUrl || undefined,
    linkWindows: raw.linkWindows || undefined,
    linkMac: raw.linkMac || undefined,
    linkLinux: raw.linkLinux || undefined,
    linkWeb: raw.linkWeb || undefined,
    videoUrl: raw.videoUrl || undefined,
    description: raw.description || undefined,
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0].message };
  }

  await db.submission.update({
    where: { id: submissionId },
    data: {
      title: parsed.data.title,
      description: parsed.data.description || null,
      coverUrl: parsed.data.coverUrl || null,
      linkWindows: parsed.data.linkWindows || null,
      linkMac: parsed.data.linkMac || null,
      linkLinux: parsed.data.linkLinux || null,
      linkWeb: parsed.data.linkWeb || null,
      screenshots: parsed.data.screenshots ?? [],
      videoUrl: parsed.data.videoUrl || null,
    },
  });

  // Update custom field values in a single transaction
  const jam = await db.jam.findUnique({
    where: { id: submission.jamId },
    include: { customFields: true },
  });
  if (jam) {
    // Validate required custom fields and URL types
    for (const field of jam.customFields) {
      const value = (formData.get(`custom_${field.id}`) as string) ?? "";
      if (field.required && !value.trim()) {
        return { error: `${field.name} is required` };
      }
      if (field.type === "URL" && value.trim()) {
        try {
          const url = new URL(value.trim());
          if (url.protocol !== "http:" && url.protocol !== "https:") {
            return { error: `${field.name} must be an http or https URL` };
          }
        } catch {
          return { error: `${field.name} must be a valid URL` };
        }
      }
    }

    const upserts = jam.customFields
      .map((field) => ({
        field,
        value: (formData.get(`custom_${field.id}`) as string) ?? "",
      }))
      .filter((fv) => fv.value)
      .map(({ field, value }) =>
        db.customFieldValue.upsert({
          where: {
            fieldId_submissionId: { fieldId: field.id, submissionId },
          },
          create: { fieldId: field.id, submissionId, value },
          update: { value },
        })
      );
    if (upserts.length > 0) {
      await db.$transaction(upserts);
    }
  }

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

  const submission = await db.submission.findUnique({
    where: { id: submissionId },
    include: { jam: true, members: true },
  });
  if (!submission) return { error: "Submission not found" };

  // Only leader can add contributors
  const isLeader = submission.members.some(
    (m) => m.userId === session.user!.id && m.isLeader
  );
  if (!isLeader) return { error: "Only the team leader can add contributors" };

  const status = computeJamStatus(submission.jam);
  if (status === "RATING" && !submission.jam.allowContributorsAfterClose) {
    return { error: "Cannot add contributors during rating period" };
  }
  if (status === "FINISHED") {
    return { error: "Cannot add contributors after jam is finished" };
  }

  // Check max team size
  if (
    submission.jam.maxTeamSize &&
    submission.members.length >= submission.jam.maxTeamSize
  ) {
    return { error: "Team is already at maximum size" };
  }

  const contributor = await db.user.findUnique({
    where: { username: contributorUsername },
    select: { id: true },
  });
  if (!contributor) return { error: "User not found" };

  // Check contributor is a participant
  const isParticipant = await db.jamParticipant.findUnique({
    where: {
      jamId_userId: { jamId: submission.jamId, userId: contributor.id },
    },
  });
  if (!isParticipant) {
    return { error: "User must join the jam first" };
  }

  // One submission per jam
  const existing = await db.submissionMember.findFirst({
    where: {
      userId: contributor.id,
      submission: { jamId: submission.jamId },
    },
  });
  if (existing) {
    return { error: "User is already part of a submission in this jam" };
  }

  try {
    await db.submissionMember.create({
      data: { submissionId, userId: contributor.id, isLeader: false },
    });
  } catch (err: unknown) {
    if (
      typeof err === "object" &&
      err !== null &&
      "code" in err &&
      (err as { code: string }).code === "P2002"
    ) {
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

  const submission = await db.submission.findUnique({
    where: { id: submissionId },
    include: { jam: true, members: true },
  });
  if (!submission) return { error: "Submission not found" };

  const isLeader = submission.members.some(
    (m) => m.userId === session.user!.id && m.isLeader
  );
  if (!isLeader) return { error: "Only the team leader can remove contributors" };

  const status = computeJamStatus(submission.jam);
  if (status === "RATING" || status === "FINISHED") {
    return { error: "Cannot remove contributors after submissions close" };
  }

  // Cannot remove the leader
  const targetMember = submission.members.find(
    (m) => m.userId === contributorUserId
  );
  if (!targetMember) return { error: "User is not on this team" };
  if (targetMember.isLeader) return { error: "Cannot remove the team leader" };

  await db.submissionMember.delete({ where: { id: targetMember.id } });

  revalidatePath(`/submissions/${submissionId}`);
  return { success: true };
}

export async function transferLeaderAction(
  submissionId: string,
  newLeaderUserId: string
) {
  const session = await auth();
  if (!session?.user?.id) return { error: "You must be signed in" };

  const submission = await db.submission.findUnique({
    where: { id: submissionId },
    include: { members: true },
  });
  if (!submission) return { error: "Submission not found" };

  const currentLeader = submission.members.find(
    (m) => m.userId === session.user!.id && m.isLeader
  );
  if (!currentLeader) return { error: "Only the team leader can transfer leadership" };

  const newLeader = submission.members.find(
    (m) => m.userId === newLeaderUserId
  );
  if (!newLeader) return { error: "User is not on this team" };

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

// Moderation actions
export async function disqualifySubmissionAction(submissionId: string) {
  const session = await auth();
  if (!session?.user?.id) return { error: "You must be signed in" };

  const submission = await db.submission.findUnique({
    where: { id: submissionId },
    include: { jam: true },
  });
  if (!submission) return { error: "Submission not found" };

  const canDisqualify = await checkJamPermission(
    submission.jamId,
    session.user.id,
    "disqualify_submission"
  );
  if (!canDisqualify) return { error: "You do not have permission" };

  await db.submission.update({
    where: { id: submissionId },
    data: { disqualified: true },
  });

  revalidatePath(`/submissions/${submissionId}`);
  revalidatePath(`/jams/${submission.jam.slug}`);
  return { success: true };
}

export async function hideSubmissionAction(submissionId: string) {
  const session = await auth();
  if (!session?.user?.id) return { error: "You must be signed in" };

  const submission = await db.submission.findUnique({
    where: { id: submissionId },
    include: { jam: true },
  });
  if (!submission) return { error: "Submission not found" };

  const canHide = await checkJamPermission(
    submission.jamId,
    session.user.id,
    "hide_submission"
  );
  if (!canHide) return { error: "You do not have permission" };

  await db.submission.update({
    where: { id: submissionId },
    data: { hidden: !submission.hidden },
  });

  revalidatePath(`/submissions/${submissionId}`);
  revalidatePath(`/jams/${submission.jam.slug}`);
  return { success: true };
}

export async function deleteSubmissionAction(submissionId: string) {
  const session = await auth();
  if (!session?.user?.id) return { error: "You must be signed in" };

  const submission = await db.submission.findUnique({
    where: { id: submissionId },
    include: { jam: true },
  });
  if (!submission) return { error: "Submission not found" };

  const canDelete = await checkJamPermission(
    submission.jamId,
    session.user.id,
    "delete_submission"
  );
  if (!canDelete) return { error: "You do not have permission" };

  await db.submission.delete({ where: { id: submissionId } });

  revalidatePath(`/jams/${submission.jam.slug}`);
  return { success: true };
}
