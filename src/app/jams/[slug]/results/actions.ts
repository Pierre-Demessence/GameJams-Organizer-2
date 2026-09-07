"use server";

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { computeJamResults } from "@/lib/scoring";
import { checkJamPermission } from "@/lib/permissions";
import { revalidatePath } from "next/cache";

export async function computeResultsAction(jamId: string) {
  const session = await auth();
  if (!session?.user?.id) return { error: "You must be signed in" };

  if (!(await checkJamPermission(jamId, session.user.id, "edit_jam"))) {
    return { error: "Not authorized" };
  }

  const jam = await db.jam.findUnique({
    where: { id: jamId },
    select: { slug: true, ranked: true, startDate: true, endDate: true, ratingEnd: true },
  });
  if (!jam) return { error: "Jam not found" };
  if (!jam.ranked) return { error: "Jam is not ranked" };

  const { computeJamStatus } = await import("@/lib/jam-status");
  const status = computeJamStatus(jam);
  if (status !== "RATING" && status !== "FINISHED") {
    return { error: "Results can only be computed during rating or after finishing" };
  }

  await computeJamResults(jamId);

  revalidatePath(`/jams/${jam.slug}/results`);
  return { success: true };
}
