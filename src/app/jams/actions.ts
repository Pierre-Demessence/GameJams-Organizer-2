"use server";

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { jamSchema, slugPattern } from "@/lib/validations";
import { checkJamPermission } from "@/lib/permissions";
import { checkStaffPermission } from "@/lib/staff-permissions";
import { checkRateLimit } from "@/lib/rate-limit";
import { revalidatePath } from "next/cache";

function validateDateOrder(data: {
  startDate?: string;
  endDate?: string;
  ratingEnd?: string;
  ranked?: boolean;
}): string | null {
  const { startDate, endDate, ratingEnd, ranked } = data;
  if (startDate && endDate) {
    if (new Date(startDate) >= new Date(endDate)) {
      return "Start date must be before end date";
    }
  }
  if (ranked && endDate && ratingEnd) {
    if (new Date(endDate) >= new Date(ratingEnd)) {
      return "End date must be before rating end date";
    }
  }
  if (ranked && ratingEnd && !endDate) {
    return "End date is required when rating end date is set";
  }
  return null;
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

  const raw = Object.fromEntries(formData.entries());
  const parsed = jamSchema.safeParse({
    ...raw,
    ranked: raw.ranked === "true",
    revealThemeOnStart: raw.revealThemeOnStart === "true",
    hideResults: raw.hideResults === "true",
    hideSubmissionsBeforeEnd: raw.hideSubmissionsBeforeEnd === "true",
    allowContributorsAfterClose: raw.allowContributorsAfterClose === "true",
    tags: raw.tags ? String(raw.tags).split(",").map((t) => t.trim()).filter(Boolean) : [],
    maxTeamSize: raw.maxTeamSize ? Number(raw.maxTeamSize) : undefined,
    startDate: raw.startDate || undefined,
    endDate: raw.endDate || undefined,
    ratingEnd: raw.ratingEnd || undefined,
    coverUrl: raw.coverUrl || undefined,
    hashtag: raw.hashtag || undefined,
    theme: raw.theme || undefined,
    submissionDetails: raw.submissionDetails || undefined,
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0].message };
  }

  const dateError = validateDateOrder(parsed.data);
  if (dateError) {
    return { error: dateError };
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
        startDate: parsed.data.startDate ? new Date(parsed.data.startDate) : null,
        endDate: parsed.data.endDate ? new Date(parsed.data.endDate) : null,
        ratingEnd: parsed.data.ratingEnd ? new Date(parsed.data.ratingEnd) : null,
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
    if (
      typeof err === "object" &&
      err !== null &&
      "code" in err &&
      (err as { code: string }).code === "P2002"
    ) {
      const meta = (err as { meta?: { target?: string[] } }).meta;
      if (meta?.target?.includes("slug")) {
        return { error: "This slug is already taken" };
      }
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

  const raw = Object.fromEntries(formData.entries());
  const parsed = jamSchema.safeParse({
    ...raw,
    ranked: raw.ranked === "true",
    revealThemeOnStart: raw.revealThemeOnStart === "true",
    hideResults: raw.hideResults === "true",
    hideSubmissionsBeforeEnd: raw.hideSubmissionsBeforeEnd === "true",
    allowContributorsAfterClose: raw.allowContributorsAfterClose === "true",
    tags: raw.tags ? String(raw.tags).split(",").map((t) => t.trim()).filter(Boolean) : [],
    maxTeamSize: raw.maxTeamSize ? Number(raw.maxTeamSize) : undefined,
    startDate: raw.startDate || undefined,
    endDate: raw.endDate || undefined,
    ratingEnd: raw.ratingEnd || undefined,
    coverUrl: raw.coverUrl || undefined,
    hashtag: raw.hashtag || undefined,
    theme: raw.theme || undefined,
    submissionDetails: raw.submissionDetails || undefined,
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0].message };
  }

  const dateError = validateDateOrder(parsed.data);
  if (dateError) {
    return { error: dateError };
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
        startDate: parsed.data.startDate ? new Date(parsed.data.startDate) : null,
        endDate: parsed.data.endDate ? new Date(parsed.data.endDate) : null,
        ratingEnd: parsed.data.ratingEnd ? new Date(parsed.data.ratingEnd) : null,
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
    if (
      typeof err === "object" &&
      err !== null &&
      "code" in err &&
      (err as { code: string }).code === "P2002"
    ) {
      const meta = (err as { meta?: { target?: string[] } }).meta;
      if (meta?.target?.includes("slug")) {
        return { error: "This slug is already taken" };
      }
    }
    return { error: "Failed to update jam" };
  }
}

export async function publishJamAction(jamId: string) {
  const session = await auth();
  if (!session?.user?.id) {
    return { error: "You must be signed in" };
  }

  const jam = await db.jam.findUnique({
    where: { id: jamId },
  });

  if (!jam) return { error: "Jam not found" };
  if (!(await checkJamPermission(jamId, session.user.id, "edit_jam"))) {
    return { error: "You do not have permission to publish this jam" };
  }

  if (!jam.startDate || !jam.endDate) {
    return { error: "Start date and end date are required to publish" };
  }
  if (jam.ranked && !jam.ratingEnd) {
    return { error: "Rating end date is required for ranked jams" };
  }

  await db.jam.update({
    where: { id: jamId },
    data: { visibility: "PUBLIC" },
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
  if (jam.deletedAt) return { success: true };

  const canDelete =
    (await checkJamPermission(jamId, session.user.id, "delete_jam")) ||
    (await checkStaffPermission(session.user.id, "delete_any_jam"));
  if (!canDelete) {
    return { error: "You do not have permission to delete this jam" };
  }

  // Free the slug so a new jam can reuse it while this one is soft-deleted.
  await db.jam.update({
    where: { id: jamId },
    data: { deletedAt: new Date(), slug: `${jam.slug}__del__${jam.id}` },
  });

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

  const { computeJamStatus } = await import("@/lib/jam-status");
  const status = computeJamStatus(jam);
  if (status !== "UPCOMING" && status !== "ONGOING") {
    return { error: "You can only join jams that are upcoming or ongoing" };
  }

  try {
    await db.jamParticipant.create({
      data: { jamId, userId: session.user.id },
    });
  } catch (err: unknown) {
    if (
      typeof err === "object" &&
      err !== null &&
      "code" in err &&
      (err as { code: string }).code === "P2002"
    ) {
      return { error: "You have already joined this jam" };
    }
    return { error: "Failed to join jam" };
  }

  revalidatePath(`/jams/${jam.slug}`);
  return { success: true };
}

export async function generateSlug(name: string): Promise<string> {
  const base = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 58);

  if (!base || base.length < 3) return "";

  if (!slugPattern.test(base)) return "";

  const existing = await db.jam.findUnique({ where: { slug: base } });
  if (!existing) return base;

  for (let i = 2; i <= 99; i++) {
    const candidate = `${base.slice(0, 55)}-${i}`;
    const taken = await db.jam.findUnique({ where: { slug: candidate } });
    if (!taken) return candidate;
  }
  return base;
}

export async function checkSlugAvailable(slug: string) {
  if (!slugPattern.test(slug)) return { available: false, reason: "Invalid slug format" };
  const existing = await db.jam.findUnique({ where: { slug }, select: { id: true } });
  return { available: !existing };
}
