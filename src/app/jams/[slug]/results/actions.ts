"use server";

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { checkJamPermission } from "@/lib/permissions";
import { jamPhase } from "@/domain/jam-phase";
import { canRevealResults } from "@/domain/results";
import { revalidatePath } from "next/cache";

export async function revealResultsAction(jamId: string) {
  const session = await auth();
  if (!session?.user?.id) return { error: "You must be signed in" };

  if (!(await checkJamPermission(jamId, session.user.id, "edit_jam"))) {
    return { error: "Not authorized" };
  }

  const jam = await db.jam.findUnique({ where: { id: jamId } });
  if (!jam) return { error: "Jam not found" };

  const decision = canRevealResults({ ...jam, phase: jamPhase(jam) });
  if (!decision.allowed) return { error: decision.reason };

  await db.jam.update({
    where: { id: jamId },
    data: { resultsRevealedAt: new Date() },
  });

  revalidatePath(`/jams/${jam.slug}`);
  revalidatePath(`/jams/${jam.slug}/results`);
  return { success: true };
}
