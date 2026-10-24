"use server";

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { profileSchema } from "@/lib/validations";
import { checkRateLimit } from "@/lib/rate-limit";

export async function updateProfileAction(formData: FormData) {
  const session = await auth();
  if (!session?.user?.id) return { error: "Not authenticated." };
  if (!(await checkRateLimit(`settings:profile:${session.user.id}`)).allowed) {
    return { error: "Too many requests. Please try again later." };
  }

  const raw = {
    displayName: (formData.get("displayName") as string) || undefined,
    bio: (formData.get("bio") as string) || undefined,
    avatarUrl: (formData.get("avatarUrl") as string) || undefined,
    username: formData.get("username") as string,
  };

  const parsed = profileSchema.safeParse(raw);
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const { username, displayName, bio, avatarUrl } = parsed.data;

  try {
    // A deleted account keeps a valid JWT for up to a minute; never write onto its tombstone.
    const { count } = await db.user.updateMany({
      where: { id: session.user.id, deletedAt: null },
      data: {
        username,
        displayName: displayName ?? null,
        bio: bio ?? null,
        avatarUrl: avatarUrl ?? null,
      },
    });
    if (count === 0) return { error: "User not found." };
  } catch (e: unknown) {
    if (typeof e === "object" && e !== null && "code" in e && e.code === "P2002") {
      return { error: "This username is already taken." };
    }
    throw e;
  }

  revalidatePath("/settings");
  revalidatePath(`/users/${username}`);
  return { success: true };
}
