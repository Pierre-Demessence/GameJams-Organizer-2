"use server";

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { slugPattern } from "@/lib/validations";
import { parseJamForm } from "@/lib/form-parsers";
import { checkJamPermission } from "@/lib/permissions";
import { checkStaffPermission } from "@/lib/staff-permissions";
import { recordAudit } from "@/lib/audit";
import { deletedJamSlug } from "@/lib/admin";
import { checkRateLimit } from "@/lib/rate-limit";
import { revalidatePath } from "next/cache";
import { canPublish, jamPhase, validateJamDates } from "@/domain/jam-phase";
import { canJoin } from "@/domain/participation";

function toDate(value: string | undefined): Date | null {
  return value ? new Date(value) : null;
}

function isUniqueViolation(err: unknown): boolean {
  return (
    typeof err === "object" &&
    err !== null &&
    "code" in err &&
    (err as { code: string }).code === "P2002"
  );
}

function isSlugConflict(err: unknown): boolean {
  if (!isUniqueViolation(err)) return false;
  const meta = (err as { meta?: { target?: string[] } }).meta;
  return meta?.target?.includes("slug") ?? false;
}

export async function createJamAction(formData: FormData) {
  const session = await auth();
  if (!session?.user?.id) {
    return { error: "You must be signed in to create a jam" };
  }

  const { allowed } = checkRateLimit(`jam:create:${session.user.id}`);
  if (!allowed) {
    return { error: "Too many requests. Please try again later." };
  }

  const parsed = parseJamForm(formData);
  if (!parsed.success) {
    return { error: parsed.error.issues[0].message };
  }

  const dates = {
    startDate: toDate(parsed.data.startDate),
    endDate: toDate(parsed.data.endDate),
    ratingEnd: toDate(parsed.data.ratingEnd),
    ranked: parsed.data.ranked,
  };
  const datesCheck = validateJamDates(dates, { requireComplete: false });
  if (!datesCheck.allowed) {
    return { error: datesCheck.reason };
  }

  try {
    const jam = await db.jam.create({
      data: {
        name: parsed.data.name,
        slug: parsed.data.slug,
        shortDesc: parsed.data.shortDesc,
        fullDesc: parsed.data.fullDesc,
        coverUrl: parsed.data.coverUrl || null,
        hashtag: parsed.data.hashtag || null,
        tags: parsed.data.tags ?? [],
        ranked: parsed.data.ranked,
        startDate: dates.startDate,
        endDate: dates.endDate,
        ratingEnd: dates.ratingEnd,
        theme: parsed.data.theme || null,
        revealThemeOnStart: parsed.data.revealThemeOnStart,
        hideResults: parsed.data.hideResults,
        hideSubmissionsBeforeEnd: parsed.data.hideSubmissionsBeforeEnd,
        submissionDetails: parsed.data.submissionDetails || null,
        maxTeamSize: parsed.data.maxTeamSize ?? null,
        allowContributorsAfterClose: parsed.data.allowContributorsAfterClose,
        ratingEligibility: parsed.data.ratingEligibility,
        visibility: parsed.data.visibility,
        createdById: session.user.id,
        roles: {
          create: {
            userId: session.user.id,
            role: "ADMIN",
          },
        },
      },
    });

    revalidatePath("/jams");
    return { success: true, slug: jam.slug };
  } catch (err: unknown) {
    if (isSlugConflict(err)) {
      return { error: "This slug is already taken" };
    }
    return { error: "Failed to create jam" };
  }
}

export async function updateJamAction(jamId: string, formData: FormData) {
  const session = await auth();
  if (!session?.user?.id) {
    return { error: "You must be signed in" };
  }

  if (!(await checkJamPermission(jamId, session.user.id, "edit_jam"))) {
    return { error: "You do not have permission to edit this jam" };
  }

  const existing = await db.jam.findUnique({
    where: { id: jamId },
    select: { publishedAt: true },
  });
  if (!existing) return { error: "Jam not found" };

  const parsed = parseJamForm(formData);
  if (!parsed.success) {
    return { error: parsed.error.issues[0].message };
  }

  const dates = {
    startDate: toDate(parsed.data.startDate),
    endDate: toDate(parsed.data.endDate),
    ratingEnd: toDate(parsed.data.ratingEnd),
    ranked: parsed.data.ranked,
  };
  // A published jam must keep a complete schedule, or it would drop back to DRAFT.
  const datesCheck = validateJamDates(dates, {
    requireComplete: existing.publishedAt !== null,
  });
  if (!datesCheck.allowed) {
    return { error: datesCheck.reason };
  }

  try {
    await db.jam.update({
      where: { id: jamId },
      data: {
        name: parsed.data.name,
        slug: parsed.data.slug,
        shortDesc: parsed.data.shortDesc,
        fullDesc: parsed.data.fullDesc,
        coverUrl: parsed.data.coverUrl || null,
        hashtag: parsed.data.hashtag || null,
        tags: parsed.data.tags ?? [],
        ranked: parsed.data.ranked,
        startDate: dates.startDate,
        endDate: dates.endDate,
        ratingEnd: dates.ratingEnd,
        theme: parsed.data.theme || null,
        revealThemeOnStart: parsed.data.revealThemeOnStart,
        hideResults: parsed.data.hideResults,
        hideSubmissionsBeforeEnd: parsed.data.hideSubmissionsBeforeEnd,
        submissionDetails: parsed.data.submissionDetails || null,
        maxTeamSize: parsed.data.maxTeamSize ?? null,
        allowContributorsAfterClose: parsed.data.allowContributorsAfterClose,
        ratingEligibility: parsed.data.ratingEligibility,
        visibility: parsed.data.visibility,
      },
    });

    revalidatePath("/jams");
    revalidatePath(`/jams/${parsed.data.slug}`);
    return { success: true, slug: parsed.data.slug };
  } catch (err: unknown) {
    if (isSlugConflict(err)) {
      return { error: "This slug is already taken" };
    }
    return { error: "Failed to update jam" };
  }
}

export async function publishJamAction(jamId: string) {
  const session = await auth();
  if (!session?.user?.id) {
    return { error: "You must be signed in" };
  }

  if (!(await checkJamPermission(jamId, session.user.id, "edit_jam"))) {
    return { error: "You do not have permission to publish this jam" };
  }

  const jam = await db.jam.findUnique({
    where: { id: jamId },
    include: { criteria: { select: { source: true, weight: true, isPrimary: true } } },
  });
  if (!jam) return { error: "Jam not found" };

  const decision = canPublish(jam);
  if (!decision.allowed) return { error: decision.reason };

  // Visibility is a separate setting: publishing an unlisted jam keeps it unlisted.
  await db.jam.update({
    where: { id: jamId },
    data: { publishedAt: new Date() },
  });

  revalidatePath("/jams");
  revalidatePath(`/jams/${jam.slug}`);
  return { success: true };
}

export async function softDeleteJamAction(jamId: string) {
  const session = await auth();
  if (!session?.user?.id) {
    return { error: "You must be signed in" };
  }

  const jam = await db.jam.findUnique({ where: { id: jamId } });
  if (!jam) return { error: "Jam not found" };

  const isOrganizer = await checkJamPermission(
    jamId,
    session.user.id,
    "delete_jam"
  );
  const isStaff = await checkStaffPermission(session.user.id, "delete_any_jam");
  if (!isOrganizer && !isStaff) {
    return { error: "You do not have permission to delete this jam" };
  }

  // Free the slug so a new jam can reuse it while this one is soft-deleted.
  await db.jam.update({
    where: { id: jamId },
    data: { deletedAt: new Date(), slug: deletedJamSlug(jam.slug, jam.id) },
  });

  if (isStaff) {
    await recordAudit({
      actorId: session.user.id,
      action: "jam:soft_delete",
      targetType: "jam",
      targetId: jamId,
      metadata: { slug: jam.slug, name: jam.name },
    });
  }

  revalidatePath("/jams");
  revalidatePath(`/jams/${jam.slug}`);
  return { success: true };
}

export async function joinJamAction(jamId: string) {
  const session = await auth();
  if (!session?.user?.id) {
    return { error: "You must be signed in to join a jam" };
  }

  const { allowed } = checkRateLimit(`jam:join:${session.user.id}`);
  if (!allowed) {
    return { error: "Too many requests. Please try again later." };
  }

  const jam = await db.jam.findUnique({ where: { id: jamId } });
  if (!jam) return { error: "Jam not found" };

  const joined = await db.jamParticipant.findUnique({
    where: { jamId_userId: { jamId, userId: session.user.id } },
  });
  const decision = canJoin({ phase: jamPhase(jam), hasJoined: joined !== null });
  if (!decision.allowed) return { error: decision.reason };

  try {
    await db.jamParticipant.create({
      data: { jamId, userId: session.user.id },
    });
  } catch (err: unknown) {
    if (isUniqueViolation(err)) {
      return { error: "You have already joined this jam" };
    }
    return { error: "Failed to join jam" };
  }

  revalidatePath(`/jams/${jam.slug}`);
  return { success: true };
}

export async function checkSlugAvailable(slug: string): Promise<{ available: boolean | null }> {
  const session = await auth();
  if (!session?.user?.id) return { available: null };
  // Unknown rather than "taken" when throttled: the save still enforces uniqueness.
  if (!checkRateLimit(`slug-check:${session.user.id}`, 120).allowed) return { available: null };
  if (!slugPattern.test(slug)) return { available: false };
  const existing = await db.jam.findUnique({ where: { slug }, select: { id: true } });
  return { available: !existing };
}
