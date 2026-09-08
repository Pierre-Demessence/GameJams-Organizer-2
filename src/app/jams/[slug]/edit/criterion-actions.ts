"use server";

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { criterionSchema } from "@/lib/validations";
import { computeJamStatus } from "@/lib/jam-status";
import { checkJamPermission } from "@/lib/permissions";
import { revalidatePath } from "next/cache";

async function verifyAdmin(jamId: string, userId: string) {
  return checkJamPermission(jamId, userId, "edit_jam");
}

async function checkCriteriaLocked(jamId: string): Promise<boolean> {
  const jam = await db.jam.findUnique({
    where: { id: jamId },
    select: { startDate: true, endDate: true, ratingEnd: true, ranked: true },
  });
  if (!jam) return true;
  const status = computeJamStatus(jam);
  return status === "RATING" || status === "FINISHED";
}

export async function createCriterionAction(jamId: string, formData: FormData) {
  const session = await auth();
  if (!session?.user?.id) return { error: "You must be signed in" };
  if (!(await verifyAdmin(jamId, session.user.id)))
    return { error: "Not authorized" };
  if (await checkCriteriaLocked(jamId))
    return { error: "Criteria cannot be modified during rating or after jam finishes" };

  const parsed = criterionSchema.safeParse({
    name: formData.get("name"),
    description: formData.get("description") || undefined,
    weight: Number(formData.get("weight") ?? 1),
    isPrimary: formData.get("isPrimary") === "on",
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const jam = await db.jam.findUnique({ where: { id: jamId }, select: { slug: true } });

  const maxSort = await db.criterion.aggregate({
    where: { jamId },
    _max: { sortOrder: true },
  });

  const created = await db.criterion.create({
    data: {
      jamId,
      name: parsed.data.name,
      description: parsed.data.description ?? null,
      weight: parsed.data.weight,
      source: parsed.data.source,
      isPrimary: parsed.data.isPrimary,
      sortOrder: (maxSort._max.sortOrder ?? -1) + 1,
    },
  });

  if (parsed.data.isPrimary) {
    await db.criterion.updateMany({
      where: { jamId, id: { not: created.id }, isPrimary: true },
      data: { isPrimary: false },
    });
  }

  if (jam) revalidatePath(`/jams/${jam.slug}/edit`);
  return { success: true };
}

export async function updateCriterionAction(
  criterionId: string,
  formData: FormData
) {
  const session = await auth();
  if (!session?.user?.id) return { error: "You must be signed in" };

  const criterion = await db.criterion.findUnique({ where: { id: criterionId } });
  if (!criterion) return { error: "Criterion not found" };
  if (!(await verifyAdmin(criterion.jamId, session.user.id)))
    return { error: "Not authorized" };
  if (await checkCriteriaLocked(criterion.jamId))
    return { error: "Criteria cannot be modified during rating or after jam finishes" };

  const parsed = criterionSchema.safeParse({
    name: formData.get("name"),
    description: formData.get("description") || undefined,
    weight: Number(formData.get("weight") ?? 1),
    isPrimary: formData.get("isPrimary") === "on",
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  await db.criterion.update({
    where: { id: criterionId },
    data: {
      name: parsed.data.name,
      description: parsed.data.description ?? null,
      weight: parsed.data.weight,
      isPrimary: parsed.data.isPrimary,
    },
  });

  if (parsed.data.isPrimary) {
    await db.criterion.updateMany({
      where: { jamId: criterion.jamId, id: { not: criterionId }, isPrimary: true },
      data: { isPrimary: false },
    });
  }

  const jam = await db.jam.findUnique({ where: { id: criterion.jamId }, select: { slug: true } });
  if (jam) revalidatePath(`/jams/${jam.slug}/edit`);
  return { success: true };
}

export async function deleteCriterionAction(criterionId: string) {
  const session = await auth();
  if (!session?.user?.id) return { error: "You must be signed in" };

  const criterion = await db.criterion.findUnique({ where: { id: criterionId } });
  if (!criterion) return { error: "Criterion not found" };
  if (!(await verifyAdmin(criterion.jamId, session.user.id)))
    return { error: "Not authorized" };
  if (await checkCriteriaLocked(criterion.jamId))
    return { error: "Criteria cannot be modified during rating or after jam finishes" };

  await db.criterion.delete({ where: { id: criterionId } });

  const jam = await db.jam.findUnique({ where: { id: criterion.jamId }, select: { slug: true } });
  if (jam) revalidatePath(`/jams/${jam.slug}/edit`);
  return { success: true };
}
