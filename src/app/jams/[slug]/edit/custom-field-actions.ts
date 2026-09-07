"use server";

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { computeJamStatus } from "@/lib/jam-status";
import { checkJamPermission } from "@/lib/permissions";
import { revalidatePath } from "next/cache";
import { z } from "zod";

const customFieldSchema = z.object({
  name: z.string().min(1, "Name is required").max(50),
  description: z.string().max(200).optional(),
  type: z.enum(["SINGLE_LINE", "MULTI_LINE", "URL"]).default("SINGLE_LINE"),
  required: z.boolean().default(false),
  isPrivate: z.boolean().default(false),
});

async function verifyJamAdmin(jamId: string, userId: string) {
  return checkJamPermission(jamId, userId, "edit_jam");
}

async function checkFieldsLocked(jamId: string): Promise<boolean> {
  const jam = await db.jam.findUnique({
    where: { id: jamId },
    select: { startDate: true, endDate: true, ratingEnd: true, ranked: true },
  });
  if (!jam) return true;
  const status = computeJamStatus(jam);
  return status === "RATING" || status === "FINISHED";
}

export async function createCustomFieldAction(jamId: string, formData: FormData) {
  const session = await auth();
  if (!session?.user?.id) return { error: "You must be signed in" };

  if (!(await verifyJamAdmin(jamId, session.user.id))) {
    return { error: "You do not have permission" };
  }

  if (await checkFieldsLocked(jamId)) {
    return { error: "Custom fields are locked after the submission period ends" };
  }

  const raw = Object.fromEntries(formData.entries());
  const parsed = customFieldSchema.safeParse({
    ...raw,
    required: raw.required === "true",
    isPrivate: raw.isPrivate === "true",
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0].message };
  }

  const maxOrder = await db.customField.aggregate({
    where: { jamId },
    _max: { sortOrder: true },
  });

  await db.customField.create({
    data: {
      jamId,
      name: parsed.data.name,
      description: parsed.data.description || null,
      type: parsed.data.type,
      required: parsed.data.required,
      isPrivate: parsed.data.isPrivate,
      sortOrder: (maxOrder._max.sortOrder ?? -1) + 1,
    },
  });

  const jam = await db.jam.findUnique({ where: { id: jamId }, select: { slug: true } });
  if (jam) revalidatePath(`/jams/${jam.slug}/edit`);
  return { success: true };
}

export async function updateCustomFieldAction(
  fieldId: string,
  jamId: string,
  formData: FormData
) {
  const session = await auth();
  if (!session?.user?.id) return { error: "You must be signed in" };

  if (!(await verifyJamAdmin(jamId, session.user.id))) {
    return { error: "You do not have permission" };
  }

  if (await checkFieldsLocked(jamId)) {
    return { error: "Custom fields are locked after the submission period ends" };
  }

  const field = await db.customField.findUnique({ where: { id: fieldId } });
  if (!field || field.jamId !== jamId) {
    return { error: "Field not found" };
  }

  const raw = Object.fromEntries(formData.entries());
  const parsed = customFieldSchema.safeParse({
    ...raw,
    required: raw.required === "true",
    isPrivate: raw.isPrivate === "true",
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0].message };
  }

  await db.customField.update({
    where: { id: fieldId },
    data: {
      name: parsed.data.name,
      description: parsed.data.description || null,
      type: parsed.data.type,
      required: parsed.data.required,
      isPrivate: parsed.data.isPrivate,
    },
  });

  const jam = await db.jam.findUnique({ where: { id: jamId }, select: { slug: true } });
  if (jam) revalidatePath(`/jams/${jam.slug}/edit`);
  return { success: true };
}

export async function deleteCustomFieldAction(fieldId: string, jamId: string) {
  const session = await auth();
  if (!session?.user?.id) return { error: "You must be signed in" };

  if (!(await verifyJamAdmin(jamId, session.user.id))) {
    return { error: "You do not have permission" };
  }

  if (await checkFieldsLocked(jamId)) {
    return { error: "Custom fields are locked after the submission period ends" };
  }

  const field = await db.customField.findUnique({ where: { id: fieldId } });
  if (!field || field.jamId !== jamId) {
    return { error: "Field not found" };
  }

  await db.customField.delete({ where: { id: fieldId } });

  const jam = await db.jam.findUnique({ where: { id: jamId }, select: { slug: true } });
  if (jam) revalidatePath(`/jams/${jam.slug}/edit`);
  return { success: true };
}
