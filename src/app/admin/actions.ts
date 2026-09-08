"use server";

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { checkStaffPermission } from "@/lib/staff-permissions";
import { recordAudit } from "@/lib/audit";
import { revalidatePath } from "next/cache";

export async function grantSiteAdminAction(identifier: string) {
  const session = await auth();
  if (!session?.user?.id) return { error: "You must be signed in" };
  if (!(await checkStaffPermission(session.user.id, "manage_staff"))) {
    return { error: "You do not have permission" };
  }

  const query = identifier.trim();
  if (!query) return { error: "Enter a username or email" };

  const user = await db.user.findFirst({
    where: { OR: [{ username: query }, { email: query }] },
    select: { id: true, username: true },
  });
  if (!user) return { error: "No user found with that username or email" };

  await db.staffRole.upsert({
    where: { userId_role: { userId: user.id, role: "SITE_ADMIN" } },
    update: {},
    create: { userId: user.id, role: "SITE_ADMIN" },
  });

  await recordAudit({
    actorId: session.user.id,
    action: "staff:grant",
    targetType: "user",
    targetId: user.id,
    metadata: { role: "SITE_ADMIN", username: user.username },
  });

  revalidatePath("/admin");
  return { success: true };
}

export async function revokeSiteAdminAction(userId: string) {
  const session = await auth();
  if (!session?.user?.id) return { error: "You must be signed in" };
  if (!(await checkStaffPermission(session.user.id, "manage_staff"))) {
    return { error: "You do not have permission" };
  }

  const adminCount = await db.staffRole.count({ where: { role: "SITE_ADMIN" } });
  if (adminCount <= 1) {
    return { error: "Cannot remove the last Site Admin" };
  }

  await db.staffRole.deleteMany({
    where: { userId, role: "SITE_ADMIN" },
  });

  await recordAudit({
    actorId: session.user.id,
    action: "staff:revoke",
    targetType: "user",
    targetId: userId,
    metadata: { role: "SITE_ADMIN" },
  });

  revalidatePath("/admin");
  return { success: true };
}
